import { Router } from 'express';
import authUser from '../middleware/authenticate.js';
import { createPaymentOrder, verifyPaymentAndCreateInvitation, getMyPayments, generateInvoicePdf, verifyMailTransport, resendInvitationEmail } from '../controllers/PaymentController.js';

const router = Router();

router.post('/create-order', authUser, createPaymentOrder);
router.post('/verify-and-create-invitation', authUser, verifyPaymentAndCreateInvitation);
router.get('/my', authUser, getMyPayments);
router.get('/:id/invoice', authUser, generateInvoicePdf);
router.get('/test-email', authUser, verifyMailTransport);
router.post('/:id/resend-email', authUser, resendInvitationEmail);

export default router;
 