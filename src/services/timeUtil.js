// Format identique a celui retourne par SQLite datetime('now') (UTC, sans 'T' ni ms)
// afin que les comparaisons textuelles avec datetime('now') restent correctes.
function toSqliteDatetime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function sqliteDatetimeInSeconds(seconds) {
  return toSqliteDatetime(new Date(Date.now() + seconds * 1000));
}

function sqliteDatetimeInDays(days) {
  return toSqliteDatetime(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

// Reparse explicitement en UTC (le format 'YYYY-MM-DD HH:MM:SS' sans 'Z' serait
// sinon interprete en heure locale du conteneur par le moteur JS).
function fromSqliteDatetime(value) {
  return new Date(`${value.replace(' ', 'T')}Z`);
}

module.exports = { toSqliteDatetime, sqliteDatetimeInSeconds, sqliteDatetimeInDays, fromSqliteDatetime };
