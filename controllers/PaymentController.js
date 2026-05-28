import crypto from 'crypto';
import nodemailer from 'nodemailer';
import Razorpay from 'razorpay';
import Invitation from '../models/invitation.js';
import User from '../models/user.js';
import PDFDocument from 'pdfkit';

const getRazorpayClient = () => {
	const keyId = process.env.RAZORPAY_KEY_ID?.trim();
	const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

	if (!keyId || !keySecret) {
		throw new Error('Razorpay credentials are not configured');
	}

	return new Razorpay({
		key_id: keyId,
		key_secret: keySecret,
	});
};

const createMailTransport = () => {
	const user = process.env.EMAIL_USER?.trim();
	const pass = process.env.EMAIL_PASS?.trim();

	if (!user || !pass) {
		throw new Error('Email credentials are not configured');
	}

	return nodemailer.createTransport({
		service: 'gmail',
		auth: { user, pass },
	});
};

const buildInvitationPayload = (invitationData, createdBy, paymentDetails = {}) => {
	const payload = {
		...invitationData,
		createdBy,
		grandparentsEnabled: Boolean(invitationData?.grandparentsEnabled),
		parentsOrder:
			invitationData?.parentsOrder === 'Groom family first'
				? "Groom's family first"
				: invitationData?.parentsOrder === 'Bride family first'
					? "Bride's family first"
					: invitationData?.parentsOrder,
		paymentStatus: 'paid',
		amountPaid: paymentDetails.amountPaid || 0,
		razorpayOrderId: paymentDetails.razorpayOrderId || '',
		razorpayPaymentId: paymentDetails.razorpayPaymentId || '',
	};

	if (invitationData?.infoCards && typeof invitationData.infoCards === 'object') {
		payload.infoCards = invitationData.infoCards;
	}

	return payload;
};

const sendInvitationEmail = async (user, invitation) => {
	if (!user?.email) 
    
 {
  console.log('User email is missing, cannot send invitation email');
return { sent: false, error: 'no_recipient_email' };
 }   

	const transporter = createMailTransport();
	const appUrl = process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
	const inviteUrl = `${appUrl}/invite/${encodeURIComponent(invitation.slug)}`;
	const coupleName = [invitation.bride, invitation.groom].filter(Boolean).join(' & ') || 'your invitation';

	try {
		// Verify SMTP connectivity first to provide clearer diagnostics
		await transporter.verify();
	} catch (verifyErr) {
		console.error('Mail transporter verify failed:', verifyErr.message);
		return { sent: false, error: `verify_failed: ${verifyErr.message}` };
	}

	try {
		await transporter.sendMail({
			from: process.env.EMAIL_USER?.trim(),
			to: user.email,
			subject: 'Your invitation has been created successfully',
			html: `
				<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
					<p>Hello ${user.name || 'there'},</p>
					<p>Your payment was successful and your invitation for <strong>${coupleName}</strong> has been created.</p>
					<p>
						<a href="${inviteUrl}" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;">Open your invite</a>
					</p>
					<p>Invitation link: <a href="${inviteUrl}">${inviteUrl}</a></p>
					<p>Thank you,<br/>EnviteYou Team</p>
				</div>
			`,
		});

		return { sent: true };
	} catch (sendErr) {
		console.error('Invitation sendMail failed:', sendErr.message);
		return { sent: false, error: `send_failed: ${sendErr.message}` };
	}
};

const getInvitationAmountInPaise = () => {
	const amountInRupees = Number(process.env.INVITATION_AMOUNT || 400);
	return Math.max(1, amountInRupees) * 100;
};

export const createPaymentOrder = async (req, res) => {
	try {
		const razorpay = getRazorpayClient();
		const amount = getInvitationAmountInPaise();

		const order = await razorpay.orders.create({
			amount,
			currency: 'INR',
			receipt: `inv-${Date.now()}`,
			payment_capture: 1,
		});

		return res.status(200).json({
			success: true,
			keyId: process.env.RAZORPAY_KEY_ID?.trim(),
			amount,
			currency: 'INR',
			order,
		});
	} catch (error) {
		console.error('Create payment order error:', error.message);
		return res.status(500).json({ success: false, message: error.message });
	}
};

export const verifyPaymentAndCreateInvitation = async (req, res) => {
	try {
		const {
			razorpay_order_id,
			razorpay_payment_id,
			razorpay_signature,
			invitationData,
		} = req.body || {};

		if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
			return res.status(400).json({ success: false, message: 'Payment verification data is required' });
		}

		if (!invitationData || typeof invitationData !== 'object') {
			return res.status(400).json({ success: false, message: 'Invitation data is required' });
		}

		const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
		if (!keySecret) {
			return res.status(500).json({ success: false, message: 'Razorpay secret is not configured' });
		}

		const expectedSignature = crypto
			.createHmac('sha256', keySecret)
			.update(`${razorpay_order_id}|${razorpay_payment_id}`)
			.digest('hex');

		if (expectedSignature !== razorpay_signature) {
			return res.status(400).json({ success: false, message: 'Invalid payment signature' });
		}

		const creatorId = req.user?.id || invitationData.createdBy || invitationData.creatorId;
		if (!creatorId) {
			return res.status(400).json({ success: false, message: 'User is required to create invitation' });
		}

		const invitationPayload = buildInvitationPayload(invitationData, creatorId, {
			razorpayOrderId: razorpay_order_id,
			razorpayPaymentId: razorpay_payment_id,
			amountPaid: getInvitationAmountInPaise(),
		});

		const invitation = await Invitation.create(invitationPayload);
		const safeUser = await User.findById(creatorId).select('name email');

		let emailSent = false;
		let emailError = null;
		try {
			const emailResult = await sendInvitationEmail(safeUser, invitation);
			emailSent = Boolean(emailResult?.sent);
			if (!emailSent) emailError = emailResult?.error || 'unknown_error';
		} catch (mailError) {
			console.error('Invitation email failed:', mailError.message);
			emailError = mailError.message;
		}

		const inviteUrl = `${process.env.FRONTEND_URL?.trim() || 'http://localhost:3000'}/invite/${encodeURIComponent(invitation.slug)}`;

		return res.status(201).json({
			success: true,
			message: 'Payment verified and invitation created successfully',
			data: invitation,
			url: inviteUrl,
			emailSent,
			emailError,
		});
	} catch (error) {
		console.error('Verify payment error:', error.message);
		return res.status(500).json({ success: false, message: error.message });
	}
};

export const getMyPayments = async (req, res) => {
	try {
		const userId = req.user?.id;
		if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

		const payments = await Invitation.find({ createdBy: userId, paymentStatus: { $exists: true } })
			.sort({ createdAt: -1 })
			.select('bride groom createdAt amountPaid paymentStatus razorpayOrderId razorpayPaymentId slug');

		const mapped = payments.map((p) => ({
			id: p._id,
			couple: [p.bride, p.groom].filter(Boolean).join(' & '),
			date: p.createdAt,
			amount: p.amountPaid || 0,
			status: p.paymentStatus || 'unknown',
			razorpayOrderId: p.razorpayOrderId || null,
			razorpayPaymentId: p.razorpayPaymentId || null,
			inviteSlug: p.slug || null,
		}));

		return res.status(200).json({ success: true, count: mapped.length, data: mapped });
	} catch (error) {
		console.error('getMyPayments error', error.message);
		return res.status(500).json({ success: false, message: error.message });
	}
};

export const generateInvoicePdf = async (req, res) => {
	try {
		const userId = req.user?.id;
		if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

		const id = req.params.id;
		if (!id) return res.status(400).json({ success: false, message: 'Invoice id is required' });

		const invitation = await Invitation.findById(id).populate('createdBy', 'name email');
		if (!invitation) return res.status(404).json({ success: false, message: 'Invitation not found' });

		// ensure the user owns this invitation
		if (String(invitation.createdBy?._id || invitation.createdBy) !== String(userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		const doc = new PDFDocument({ size: 'A4', margin: 50 });

		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `attachment; filename=invoice-${invitation._id}.pdf`);

		doc.fontSize(20).text('EnviteYou', { align: 'left' });
		doc.moveDown();

		const invoiceNo = `EVY-${String(invitation._id).slice(-8).toUpperCase()}`;
		doc.fontSize(12).text(`Invoice: ${invoiceNo}`);
		doc.text(`Date: ${new Date(invitation.createdAt).toLocaleString()}`);
		doc.moveDown();

		doc.fontSize(12).text('Billed To:');
		doc.fontSize(11).text(`${invitation.createdBy?.name || 'Customer'}`);
		doc.fontSize(11).text(`${invitation.createdBy?.email || ''}`);
		doc.moveDown();

		doc.fontSize(12).text('Description:');
		const couple = [invitation.bride, invitation.groom].filter(Boolean).join(' & ') || 'Invitation';
		doc.fontSize(11).text(`Invitation for ${couple}`);
		doc.moveDown();

		const amount = Number(invitation.amountPaid || 0) / 100;
		doc.fontSize(12).text(`Amount: INR ${amount.toFixed(0)}`);
		doc.moveDown();

		doc.fontSize(10).text(`Razorpay Order ID: ${invitation.razorpayOrderId || 'N/A'}`);
		doc.text(`Razorpay Payment ID: ${invitation.razorpayPaymentId || 'N/A'}`);
		doc.moveDown();

		const inviteUrl = `${process.env.FRONTEND_URL?.trim() || 'http://localhost:3000'}/invite/${encodeURIComponent(invitation.slug)}`;
		doc.fontSize(10).text(`Invitation URL: ${inviteUrl}`);

		doc.end();
		doc.pipe(res);
	} catch (error) {
		console.error('generateInvoicePdf error', error.message);
		return res.status(500).json({ success: false, message: error.message });
	}
};

export const verifyMailTransport = async (req, res) => {
	try {
		const transporter = createMailTransport();
		await transporter.verify();
		return res.status(200).json({ success: true, message: 'SMTP verified' });
	} catch (err) {
		console.error('SMTP verify error', err.message);
		return res.status(500).json({ success: false, message: err.message });
	}
};

export const resendInvitationEmail = async (req, res) => {
	try {
		const userId = req.user?.id;
		if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

		const { id } = req.params;
		if (!id) return res.status(400).json({ success: false, message: 'Invitation id required' });

		const invitation = await Invitation.findById(id);
		if (!invitation) return res.status(404).json({ success: false, message: 'Invitation not found' });

		// ensure the user owns this invitation
		if (String(invitation.createdBy) !== String(userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		const user = await User.findById(userId).select('name email');
		const result = await sendInvitationEmail(user, invitation);

		return res.status(200).json({ success: true, emailResult: result });
	} catch (error) {
		console.error('resendInvitationEmail error', error.message);
		return res.status(500).json({ success: false, message: error.message });
	}
};
