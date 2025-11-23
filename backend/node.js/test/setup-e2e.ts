import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.test for e2e tests
config({ path: resolve(__dirname, '../.env.test') });
