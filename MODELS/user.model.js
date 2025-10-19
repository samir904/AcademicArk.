import { Schema,model } from "mongoose";
import  jwt  from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";


const userSchema=new Schema({
    fullName:{
        type:String,
        required:true,
        trim:true,
        minlength:[3,"Full name must be atleast 5 character long "],
        maxlength:[25,"Full name must be less than 25 character"],
        lowercase:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
        trim:true,
        match: [/^[^@]+@[^@]+\.[^@]+$/, "Please enter a valid email address"],
        lowerCase:true
    },
    password:{
        type:String,
        required:true,
        minLength:[8,"Password must be atleast 8 character long"],
        select:false,
    },
    avatar:{
        public_id:{
            type:String
        },
        secure_url:{
            type:String
        }
    },
    role:{
        type:String,
        enum:["USER","TEACHER","ADMIN"],
        default:"USER"
    },
    // NEW: Bio and social links
    bio: {
        type: String,
        maxlength: [200, "Bio must be less than 200 characters"],
        default: ""
    },
    socialLinks: {
        github: {
            type: String,
            default: "",
            validate: {
                validator: function(v) {
                    if (!v) return true;
                    return /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+\/?$/.test(v);
                },
                message: "Invalid GitHub URL"
            }
        },
        linkedin: {
            type: String,
            default: "",
            validate: {
                validator: function(v) {
                    if (!v) return true;
                    return /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[a-zA-Z0-9_-]+\/?$/.test(v);
                },
                message: "Invalid LinkedIn URL"
            }
        },
        twitter: {
            type: String,
            default: "",
            validate: {
                validator: function(v) {
                    if (!v) return true;
                    return /^https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]+\/?$/.test(v);
                },
                message: "Invalid Twitter/X URL"
            }
        },
        website: {
            type: String,
            default: "",
            validate: {
                validator: function(v) {
                    if (!v) return true;
                    return /^https?:\/\/.+\..+/.test(v);
                },
                message: "Invalid website URL"
            }
        }
    },
    // NEW: Profile visibility settings
    isProfilePublic: {
        type: Boolean,
        default: true
    },
    forgotPasswordToken:{
        type:String
    },
    forgotPasswordExpiry:{
        type:Date
    },
    authProvider:{
        type:String,
        default:'email'
    }


},{
    timestamps:true
})

userSchema.index({ role: 1 }); // accelerate role-based queries
userSchema.index({ forgotPasswordToken: 1 });     // speed up password reset lookups
userSchema.index({ isProfilePublic: 1 }); // NEW: Index for public profiles

userSchema.pre("save",async function (next) {
    if(!this.isModified("password")){
        return next();
    }
    try{
        this.password=await bcrypt.hash(this.password,10);
        next();
    }catch(error){
        console.error(`hashing password error ${error}`);
        next(error)
    }
})

userSchema.methods={
    generateJWTToken:async function () {
        return await jwt.sign(
            {
                id:this._id,
                email:this.email,
                role:this.role
            },
            process.env.JWT_SECRET,{
                expiresIn:process.env.JWT_EXPIRY
            }
        )
    },

    comparePassword:async function(plainTextPassword){
        return await bcrypt.compare(plainTextPassword,this.password)
    },

    generatePasswordResetToken:async function () {
        const resetToken=crypto.randomBytes(20).toString("hex");
        this.forgotPasswordToken=crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex")
        this.forgotPasswordExpiry=Date.now()+15*60*1000;
        return resetToken;
    }

}


const User=model("User",userSchema);

export default User;