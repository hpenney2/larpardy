declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production";
      VITE_DISCORD_CLIENT_ID: string;
      DISCORD_CLIENT_SECRET: string;
      DISCORD_BOT_TOKEN: string;
      REDIS_URL: string;
      REDIS_PASS: string;
      INFLUX_HOST: string;
      INFLUX_DATABASE: string;
      INFLUX_TOKEN: string;
      POSTGRES_USER: string;
      POSTGRES_PASSWORD: string;
      POSTGRES_HOST: string;
      HOSTER_ID: string;

      HOSTER_GUILD: string | undefined;
    }
  }
}

export {};
