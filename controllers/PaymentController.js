import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
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
		host: "smtp.gmail.com",
		port: 465,
		secure: true,
		family: 4,
		auth: { user, pass },
		tls: {
			rejectUnauthorized: false,
		},
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
	if (!user?.email) {
		console.log('User email is missing, cannot send invitation email');
		return { sent: false, error: 'no_recipient_email' };
	}

	const appUrl = process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
	const inviteUrl = `${appUrl}/invite/${encodeURIComponent(invitation.slug)}`;
	const coupleName = [invitation.bride, invitation.groom].filter(Boolean).join(' & ') || 'your invitation';

	let transporter;
	try {
		transporter = createMailTransport();
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

		const doc = new PDFDocument({ size: 'A4', margin: 48 });
		const invoiceNo = `EVY-${String(invitation._id).slice(-8).toUpperCase()}`;
		const inviteUrl = `${process.env.FRONTEND_URL?.trim() || 'http://localhost:3000'}/invite/${encodeURIComponent(invitation.slug)}`;
		const couple = [invitation.bride, invitation.groom].filter(Boolean).join(' & ') || 'Invitation';
		const amount = Number(invitation.amountPaid || 0) / 100;
		const logoPath = path.resolve(process.cwd(), '..', 'frontend', 'public', 'logo.png');
		const hasLogo = fs.existsSync(logoPath);

		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceNo}.pdf"`);

		doc.pipe(res);

		// Header block
		doc.rect(0, 0, doc.page.width, 140).fill('#111827');
		if (hasLogo) {
			doc.image(logoPath, 48, 34, { fit: [104, 52] });
		} else {
			doc.fillColor('#ffffff').fontSize(26).font('Helvetica-Bold').text('EnviteYou', 48, 44);
		}
		doc.fillColor('#ffffff').fontSize(11).font('Helvetica').text('Digital invitation invoice', 48, 82);

		doc.roundedRect(doc.page.width - 220, 36, 172, 68, 12).fill('#ffffff');
		doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10).text('INVOICE', doc.page.width - 200, 50);
		doc.fontSize(14).text(invoiceNo, doc.page.width - 200, 66);

		doc.moveDown(6);

		// Details area
		doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold').text('Billed To', 48, 170);
		doc.font('Helvetica').fontSize(11).text(invitation.createdBy?.name || 'Customer', 48, 188);
		doc.text(invitation.createdBy?.email || '', 48, 203);

		doc.font('Helvetica-Bold').text('Invoice Date', 340, 170);
		doc.font('Helvetica').text(new Date(invitation.createdAt).toLocaleString(), 340, 188);

		doc.font('Helvetica-Bold').text('Payment Status', 340, 220);
		doc.font('Helvetica').text(String(invitation.paymentStatus || 'paid').toUpperCase(), 340, 238);

		// Invoice table header
		const tableTop = 280;
		doc.roundedRect(48, tableTop, doc.page.width - 96, 34, 8).fill('#f3f4f6');
		doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(10);
		doc.text('Description', 60, tableTop + 12);
		doc.text('Reference', 360, tableTop + 12);
		doc.text('Amount', 470, tableTop + 12, { width: 120, align: 'right' });

		const rowY = tableTop + 34;
		doc.fillColor('#111827').font('Helvetica').fontSize(11);
		doc.text(`Invitation for ${couple}`, 60, rowY + 14, { width: 280 });
		doc.text(invitation.razorpayPaymentId || 'N/A', 360, rowY + 14, { width: 100 });
		doc.font('Helvetica-Bold').text(`INR ${amount.toFixed(0)}`, 470, rowY + 14, { width: 120, align: 'right' });

		doc.moveTo(48, rowY + 54).lineTo(doc.page.width - 48, rowY + 54).strokeColor('#e5e7eb').stroke();

		// Summary box
		const summaryTop = rowY + 84;
		doc.roundedRect(48, summaryTop, doc.page.width - 96, 112, 14).fill('#f9fafb');
		doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text('Invoice Summary', 64, summaryTop + 16);
		doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text(`Order ID: ${invitation.razorpayOrderId || 'N/A'}`, 64, summaryTop + 38);
		doc.text(`Payment ID: ${invitation.razorpayPaymentId || 'N/A'}`, 64, summaryTop + 56);
		doc.text(`Invitation URL: ${inviteUrl}`, 64, summaryTop + 74, { width: 470 });
		doc.fillColor('#111827').font('Helvetica-Bold').fontSize(22).text(`INR ${amount.toFixed(0)}`, 430, summaryTop + 44, { width: 160, align: 'right' });
		doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text('Total Paid', 430, summaryTop + 20, { width: 160, align: 'right' });

		// Footer
		doc.fillColor('#6b7280').font('Helvetica').fontSize(9).text('This is a system-generated invoice from EnviteYou.', 48, doc.page.height - 70, { align: 'center', width: doc.page.width - 96 });

		doc.end();
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
