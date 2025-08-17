import { createClient } from "redis";
// import {config} from "dotenv"
// config();
const client=createClient({
    url:process.env.REDIS_URL|| 'redis://localhost:6379'
});

client.on('error',(err)=>{
    console.error(`Redis client error`,err)
})
try{
await client.connect();
}catch(err){
    console.log("Redis error",err)
}

export default client;