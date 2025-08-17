import redisClient from "../CONFIG/redisClient.js"

export const cacheNotes=(req,res,next)=>{
    const key=`notes:${JSON.stringify(req.query)}`;  // unique per filter

    redisClient.get(key)
    .then(cached=>{
        if(cached){
            console.log(`cache reponse`)
            return res.status(200).json(
                JSON.parse(cached)
            )
        }
        //override res.send to cache the response
        const originaljson=res.json.bind(res);
        res.json=(data)=>{
            redisClient.setEx(key,120,JSON.stringify(data));//ttl=120s
            return originaljson(data)
        };
        next();
    }).catch(next);
};