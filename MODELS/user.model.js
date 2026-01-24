import { Schema, model } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";


const userSchema = new Schema({
    fullName: {
        type: String,
        required: true,
        trim: true,
        minlength: [3, "Full name must be atleast 5 character long "],
        maxlength: [25, "Full name must be less than 25 character"],
        lowercase: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        match: [/^[^@]+@[^@]+\.[^@]+$/, "Please enter a valid email address"],
        lowerCase: true
    },
    password: {
        type: String,
        required: true,
        minLength: [8, "Password must be atleast 8 character long"],
        select: false,
    },
    avatar: {
        public_id: {
            type: String
        },
        secure_url: {
            type: String
        }
    },
    role: {
        type: String,
        enum: ["USER", "TEACHER", "ADMIN"],
        default: "USER"
    },
    // ✨ NEW: Planner-related fields
    studyPreference: {
        type: Schema.Types.ObjectId,
        ref: "StudyPreference",
        default: null
    },

    totalStudyTimeMinutes: {
        type: Number,
        default: 0
    },

    studyStreak: {
        type: Number,
        default: 0
    },

    lastStudyDate: {
        type: Date,
        default: null
    },

    plannerSetup: {
        isCompleted: {
            type: Boolean,
            default: false
        },
        completedAt: Date
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
                validator: function (v) {
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
                validator: function (v) {
                    if (!v) return true;
                    // Just verify it's a valid linkedin.com URL
                    return /^https?:\/\/([a-z0-9-]+\.)*linkedin\.com\/.+$/i.test(v);
                },
                message: "Invalid LinkedIn URL"
            }
        }

        ,
        twitter: {
            type: String,
            default: "",
            validate: {
                validator: function (v) {
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
                validator: function (v) {
                    if (!v) return true;
                    return /^https?:\/\/.+\..+/.test(v);
                },
                message: "Invalid website URL"
            }
        }
    }, // ✨ NEW: ACADEMIC PROFILE - CRITICAL FOR PERSONALIZATION
    academicProfile: {
        // ✅ Track if profile is completed
        isCompleted: {
            type: Boolean,
            default: false
        },

        // ✅ Semester (1-8)
        semester: {
            type: Number,
            enum: [1, 2, 3, 4, 5, 6, 7, 8],
            default: null
        },

        // ✨ UPDATED: College with predefined list + custom
        college: {
            // College name - either predefined or custom
            name: {
                type: String,
                default: "",
                trim: true,
                maxlength: [100, "College name must be less than 100 characters"]
            },

            // ✨ NEW: Is it a predefined college or custom?
            isPredefined: {
                type: Boolean,
                default: true
            },

            // ✨ NEW: If custom, approval status
            isApproved: {
                type: Boolean,
                default: false  // Needs admin approval
            }
        },

        // ✅ Branch/Stream
        branch: {
            type: String,
            enum: [
                "CSE",           // Computer Science
                "IT",            // Information Technology
                "ECE",           // Electronics & Communication
                "EEE",           // Electrical & Electronics
                "MECH",          // Mechanical
                "CIVIL",         // Civil
                "CHEMICAL",      // Chemical
                "BIOTECH",       // Biotechnology
                "OTHER"          // Other
            ],
            default: null
        },

        // ✅ Profile last updated
        lastUpdated: {
            type: Date,
            default: null
        }
    },
    // NEW: Profile visibility settings
    isProfilePublic: {
        type: Boolean,
        default: true
    },
    forgotPasswordToken: {
        type: String
    },
    forgotPasswordExpiry: {
        type: Date
    },
    authProvider: {
        type: String,
        default: 'email'
    },
    excludeFromLeaderboard: {
        type: Boolean,
        default: false,  // By default, all users are included
        index: true      // For fast filtering
    },
    // ✨ NEW: Track last homepage visit
    lastHomepageVisit: {
        type: Date,
        default: null
    },

    // ✨ NEW: Track personalization preferences
    personalizationSettings: {
        showContinueWhere: {
            type: Boolean,
            default: true
        },
        showRecommended: {
            type: Boolean,
            default: true
        },
        showTrending: {
            type: Boolean,
            default: true
        }
    }

}, {
    timestamps: true
})// ✨ NEW: Index for college queries
userSchema.index({ 'academicProfile.college.name': 1 });
userSchema.index({ 'academicProfile.college.isPredefined': 1 });
// ✨ NEW: Add indexes for analytics queries
userSchema.index({ 'academicProfile.semester': 1 });
userSchema.index({ 'academicProfile.college': 1 });
userSchema.index({ 'academicProfile.branch': 1 });
userSchema.index({ 'academicProfile.isCompleted': 1 });
userSchema.index({ role: 1 }); // accelerate role-based queries
userSchema.index({ forgotPasswordToken: 1 });     // speed up password reset lookups
userSchema.index({ isProfilePublic: 1 }); // NEW: Index for public profiles

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    try {
        this.password = await bcrypt.hash(this.password, 10);
        next();
    } catch (error) {
        console.error(`hashing password error ${error}`);
        next(error)
    }
})

userSchema.methods = {
    generateJWTToken: async function () {
        return await jwt.sign(
            {
                id: this._id,
                email: this.email,
                role: this.role,
                semester: this.academicProfile?.semester || null  // ⭐ ADD THIS
            },
            process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRY
        }
        )
    },

    comparePassword: async function (plainTextPassword) {
        return await bcrypt.compare(plainTextPassword, this.password)
    },

    generatePasswordResetToken: async function () {
        const resetToken = crypto.randomBytes(20).toString("hex");
        this.forgotPasswordToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex")
        this.forgotPasswordExpiry = Date.now() + 15 * 60 * 1000;
        return resetToken;
    }

}


const User = model("User", userSchema);

export default User;