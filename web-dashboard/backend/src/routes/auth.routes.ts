import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db, JWT_SECRET, ADMIN_DISCORD_IDS } from '../websocket/wsClient';

const router = Router();

// Developer Mock login bypass endpoint
router.get('/dev-login', (req: Request, res: Response) => {
  const username = (req.query.username as string) || 'Yanggu';
  const nonAdmin = req.query.nonAdmin === 'true';
  const roles = nonAdmin ? [] : ['1360409328175153242'];

  if (!db) {
    return res.status(500).json({ success: false, message: '資料庫未連接' });
  }

  try {
    const getBinding = db.prepare('SELECT * FROM bindings WHERE mc_username = ? COLLATE NOCASE');
    const binding = getBinding.get(username) as any;

    if (!binding) {
      const dummyDiscordId = `dev-discord-${Math.floor(Math.random() * 10000)}`;
      const dummyUuid = `dev-uuid-${Math.floor(Math.random() * 10000)}`;
      const addBinding = db.prepare('INSERT INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)');
      addBinding.run(dummyDiscordId, dummyUuid, username);
      
      const token = jwt.sign({ 
        mc_uuid: dummyUuid, 
        mc_username: username, 
        discord_id: nonAdmin ? dummyDiscordId : '1248891236480188517',
        roles,
        profile: {
          roles,
          isAdmin: !nonAdmin
        }
      }, JWT_SECRET, { expiresIn: '7d' });
      
      return res.json({
        success: true,
        message: '開發者模式建立全新測試綁定登入',
        token,
        user: { mc_username: username, mc_uuid: dummyUuid }
      });
    }

    const token = jwt.sign({ 
      mc_uuid: binding.mc_uuid, 
      mc_username: binding.mc_username, 
      discord_id: nonAdmin ? binding.discord_id : '1248891236480188517',
      roles,
      profile: {
        roles,
        isAdmin: !nonAdmin
      }
    }, JWT_SECRET, { expiresIn: '7d' });
    
    return res.json({
      success: true,
      message: '開發者模式成功登入',
      token,
      user: { mc_username: binding.mc_username, mc_uuid: binding.mc_uuid }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// OAuth Callback mock redirector
router.get('/url', (req: Request, res: Response) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/callback');
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
  res.json({ url });
});

router.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  if (!db) {
    return res.status(500).send('Database connection unavailable');
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || '',
        client_secret: process.env.DISCORD_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: process.env.DISCORD_REDIRECT_URI || '',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Discord OAuth] Token exchange failed:', errorText);
      return res.redirect(`${frontendUrl}/?error=token_exchange_failed`);
    }

    const tokenData = (await tokenResponse.json()) as any;
    const accessToken = tokenData.access_token;

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      console.error('[Discord OAuth] Failed to fetch user profile');
      return res.redirect(`${frontendUrl}/?error=user_fetch_failed`);
    }

    const userData = (await userResponse.json()) as any;
    const realDiscordId = userData.id;

    const getBinding = db.prepare('SELECT * FROM bindings WHERE discord_id = ?');
    const binding = getBinding.get(realDiscordId) as any;

    if (!binding) {
      console.warn(`[Discord OAuth] Discord User ${userData.username}#${userData.discriminator} (${realDiscordId}) is not bound in database.`);
      return res.redirect(`${frontendUrl}/?error=not_bound&discord_id=${realDiscordId}&discord_username=${encodeURIComponent(userData.username)}`);
    }

    const roles: string[] = [];
    const isAdmin = ADMIN_DISCORD_IDS.has(realDiscordId);

    const token = jwt.sign(
      { 
        mc_uuid: binding.mc_uuid, 
        mc_username: binding.mc_username, 
        discord_id: realDiscordId,
        roles,
        profile: {
          roles,
          isAdmin
        }
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.redirect(`${frontendUrl}/?token=${token}&username=${binding.mc_username}&uuid=${binding.mc_uuid}`);
  } catch (err: any) {
    console.error('[Discord OAuth] Callback error:', err);
    res.status(500).send(err.message);
  }
});

export default router;
