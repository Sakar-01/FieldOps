type Fields = Record<string, unknown>;

// NFR-OBS-01: one JSON object per line.
function write(level: "info" | "error", msg: string, fields: Fields) {
  if (process.env.NODE_ENV === "test") return;
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, fields: Fields = {}) => write("info", msg, fields),
  error: (msg: string, fields: Fields = {}) => write("error", msg, fields),
};
