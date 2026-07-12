const { PermissionFlagsBits } = require('discord.js');
const { PermissionError } = require('../../utils/AppError');
const config = require('../../config');

/**
 * Checks if the user has permission to execute the command.
 * Utilizes Guild Administrator check and config.discord.adminRoleIds whitelist check.
 */
async function permissionCheckMiddleware(interaction, command, next) {
  const requiresAdmin = command.adminOnly || 
                        command.isAdminOnly || 
                        (command.data && (
                          command.data.default_member_permissions === PermissionFlagsBits.Administrator ||
                          command.data.default_member_permissions === PermissionFlagsBits.Administrator.toString()
                        ));

  if (requiresAdmin) {
    const member = interaction.member;

    if (!member) {
      throw new PermissionError('此指令只能在伺服器頻道中使用。');
    }

    const isAdmin = (member.permissions && typeof member.permissions.has === 'function' && member.permissions.has(PermissionFlagsBits.Administrator)) ||
                    (config.discord.adminRoleIds && member.roles && member.roles.cache && config.discord.adminRoleIds.some(rId => member.roles.cache.has(rId)));

    if (!isAdmin) {
      throw new PermissionError('您無權限執行此指令。');
    }
  }

  await next();
}

module.exports = permissionCheckMiddleware;
