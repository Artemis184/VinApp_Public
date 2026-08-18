import { Router } from 'express';
import { forgotPassword, verifyResetCode, resetPassword } from './password.controller';
import { resetPasswordRateLimiter, verifyPinRateLimiter } from './password.rate-limit';
import { requireJsonContentType } from '../../middlewares/requireJsonContentType';

const router = Router();

router.post('/password/forgot', requireJsonContentType, forgotPassword);
router.post('/password/verify', requireJsonContentType, verifyPinRateLimiter, verifyResetCode);
router.post('/password/reset', requireJsonContentType, resetPasswordRateLimiter, resetPassword);

export default router;
