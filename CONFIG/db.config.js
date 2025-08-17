import mongoose  from "mongoose";
import {config} from "dotenv"
config();
const mongo_uri=process.env.MONGO_URI||"mongodb://127.0.0.1:27017/academicark"

async function dbConnection() {
    try{
        const {connection} =await mongoose.connect(mongo_uri)
        if(connection){
            console.log(`DB IS CONNECTED TO : ${connection.host}!`)
        }
    }catch(e){
        console.error(e);
    }
}

export default dbConnection;