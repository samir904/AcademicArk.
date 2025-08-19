import { createClient } from 'redis';

import {config} from "dotenv"
config();

// console.log(process.env.REDIS_PASSWORD)

const client = createClient({
    username: 'default',
    password:process.env.REDIS_PASSWORD,
    socket: {
        host:process.env.REDIS_HOST,
        port:process.env.REDIS_PORT
    }
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

await client.set('foo', 'bar');
const result = await client.get('foo');
console.log(result)  // >>> bar

export default client