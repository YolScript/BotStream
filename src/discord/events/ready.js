module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`[discord] Connecte en tant que ${client.user.tag}`);
  },
};
