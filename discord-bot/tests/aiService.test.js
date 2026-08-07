const aiService = require('../src/services/aiService');

describe('aiService OpenRouter & Gemini Background Captioning Integration', () => {
  let originalFetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('should call OpenRouter API for text-only messages', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '喵嗚～ 我是雲喵！使用 DeepSeek V4 Flash 為你服務喔！😼💙'
            }
          }
        ]
      })
    });

    const contextUser = { id: '123456789', username: 'testuser', displayName: '測試玩家' };
    const response = await aiService.generateAiResponse('你好，介紹一下你自己！', contextUser, [], 'channel-text-only');

    expect(global.fetch).toHaveBeenCalled();
    const fetchArgs = global.fetch.mock.calls[0];
    expect(fetchArgs[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    
    const body = JSON.parse(fetchArgs[1].body);
    expect(body.model).toBe('deepseek/deepseek-v4-flash-0731');
    expect(response).toContain('我是雲喵');
  });

  test('should parse and include text file attachments (.py, .js, .txt) in the prompt', async () => {
    global.fetch = jest.fn().mockImplementation(async (url) => {
      if (url.includes('script.py')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => Buffer.from('print("Hello from Python script")')
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: '這段 Python 程式碼會印出 Hello 訊息喵！'
              }
            }
          ]
        })
      });
    });

    const contextUser = { id: '123456789', username: 'testuser', displayName: '測試玩家' };
    const attachments = [{ url: 'https://cdn.discordapp.com/attachments/123/456/script.py', name: 'script.py', contentType: 'text/x-python' }];

    const response = await aiService.generateAiResponse('幫我看這個檔內容', contextUser, attachments, 'channel-file-test');

    expect(global.fetch).toHaveBeenCalled();
    const openrouterCall = global.fetch.mock.calls.find(c => c[0].includes('openrouter.ai'));
    expect(openrouterCall).toBeDefined();
    
    const body = JSON.parse(openrouterCall[1].body);
    const userMsg = body.messages.find(m => m.role === 'user');
    expect(userMsg.content).toContain('script.py');
    expect(userMsg.content).toContain('print("Hello from Python script")');
    expect(response).toContain('這段 Python 程式碼');
  });

  test('should correctly decode Big5/ANSI encoded text files (e.g. Windows Notepad 估價單.txt)', async () => {
    // Exact Big5 encoded bytes for "電腦組裝估價單"
    const big5Bytes = Uint8Array.from([
      0xb9, 0x71, 0xb8, 0xa3, 0xb2, 0xd5, 0xb8, 0xcb, 0xa6, 0xf4, 0xbb, 0xf9, 0xb3, 0xe6
    ]);

    global.fetch = jest.fn().mockImplementation(async (url) => {
      if (url.includes('quote.txt')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => big5Bytes.buffer
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: '這是一份電腦組裝估價單喵！'
              }
            }
          ]
        })
      });
    });

    const contextUser = { id: '123456789', username: 'testuser', displayName: '測試玩家' };
    const attachments = [{ url: 'https://cdn.discordapp.com/attachments/123/456/quote.txt', name: 'quote.txt', contentType: 'text/plain' }];

    const response = await aiService.generateAiResponse('幫我看這張估價單', contextUser, attachments, 'channel-big5-test');

    const openrouterCall = global.fetch.mock.calls.find(c => c[0].includes('openrouter.ai'));
    expect(openrouterCall).toBeDefined();

    const body = JSON.parse(openrouterCall[1].body);
    const userMsg = body.messages.find(m => m.role === 'user');
    // Ensure Big5 decoded Chinese text is present without garbled text
    expect(userMsg.content).toContain('電腦組裝估價單');
  });

  test('should perform background Gemini captioning for images and pass summary to OpenRouter DeepSeek', async () => {
    global.fetch = jest.fn().mockImplementation(async (url) => {
      if (url.includes('image.png')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => Buffer.from('fake-image-bytes')
        });
      }
      if (url.includes('generativelanguage.googleapis.com')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: '圖中包含一張標題為「280分學渣逆襲考清華」的迷因圖像。' }]
                }
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: '喵嗚～ 哇靠，這張迷因圖也太熱血了吧！280分逆襲清華！😼✨'
              }
            }
          ]
        })
      });
    });

    const contextUser = { id: '123456789', username: 'testuser', displayName: '測試玩家' };
    const attachments = [{ url: 'https://cdn.discordapp.com/attachments/123/456/image.png', contentType: 'image/png' }];
    
    const response = await aiService.generateAiResponse('你看這張圖片！', contextUser, attachments, 'channel-image-test');

    expect(global.fetch).toHaveBeenCalled();
    const geminiCall = global.fetch.mock.calls.find(c => c[0].includes('generativelanguage.googleapis.com'));
    expect(geminiCall).toBeDefined();

    const openrouterCall = global.fetch.mock.calls.find(c => c[0].includes('openrouter.ai'));
    expect(openrouterCall).toBeDefined();

    const body = JSON.parse(openrouterCall[1].body);
    const userMsg = body.messages.find(m => m.role === 'user');
    expect(userMsg.content).toContain('迷因圖像');
    expect(response).toContain('迷因圖也太熱血了吧');
  });

  test('should handle tool calls correctly with OpenRouter', async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async (url, options) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: 'call_joke_1',
                      type: 'function',
                      function: {
                        name: 'get_random_joke',
                        arguments: '{}'
                      }
                    }
                  ]
                }
              }
            ]
          })
        });
      } else {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: '這裡有一個冷笑話喵！'
                }
              }
            ]
          })
        });
      }
    });

    const contextUser = { id: '123456789', username: 'testuser', displayName: '測試玩家' };
    const response = await aiService.generateAiResponse('講個笑話吧', contextUser, [], 'channel-tool-test');

    expect(callCount).toBe(2);
    expect(response).toBe('這裡有一個冷笑話喵！');
  });
});
