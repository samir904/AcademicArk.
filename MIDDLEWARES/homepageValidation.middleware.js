// MIDDLEWARES/homepageValidation.middleware.js
import { query, validationResult } from 'express-validator';

export const validateHomepageQuery = [
    query('semester')
        .optional()
        .isInt({ min: 1, max: 8 })
        .withMessage('Invalid semester'),
    
    query('branch')
        .optional()
        .isIn(['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEMICAL', 'BIOTECH'])
        .withMessage('Invalid branch'),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        next();
    }
];
