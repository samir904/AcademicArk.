import { Schema, model } from "mongoose";
import mongoose from "mongoose";

const videoPlaylistSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, "Playlist title must be less than 100 characters"]
    },
    
    description: {
        type: String,
        trim: true,
        maxlength: [500, "Description must be less than 500 characters"]
    },
    
    subject: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    
    chapter: {
        number: {
            type: Number,
            required: true
        },
        title: {
            type: String,
            required: true
        }
    },
    
    semester: {
        type: Number,
        required: true
    },
    
    branch: {
        type: String,
        required: true
    },
    
    course: {
        type: String,
        default: "BTECH"
    },
    
    university: {
        type: String,
        default: "AKTU"
    },
    
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    
    videos: [{
        type: Schema.Types.ObjectId,
        ref: "Video"
    }],
    
    totalVideos: {
        type: Number,
        default: 0
    },
    
    totalDuration: {
        type: Number,
        default: 0
        // In seconds
    },
    
    isPublished: {
        type: Boolean,
        default: true
    },
    
    thumbnail: {
        type: String
        // Thumbnail of first video
    },
    
    views: {
        type: Number,
        default: 0
    },
    
    followers: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }]

}, { timestamps: true });

const VideoPlaylist = mongoose.models.VideoPlaylist || model("VideoPlaylist", videoPlaylistSchema);

export default VideoPlaylist;

