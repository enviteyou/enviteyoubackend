import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import Razorpay from 'razorpay';
import Invitation from '../models/invitation.js';
import User from '../models/user.js';
import Template from '../models/template.js';
import PDFDocument from 'pdfkit';
import jwt from 'jsonwebtoken';

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
		host: 'smtp-relay.brevo.com',
		port: 2525,
		secure: false,      // port 587 uses STARTTLS, NOT SSL
		requireTLS: true,   // enforce STARTTLS upgrade
		auth: { user, pass },
		tls: { rejectUnauthorized: false },

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
			from: `"EnviteYou" <theenviteyou@gmail.com>`,
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
		const { templateId, isVendor } = req.body || {};

		// Fetch price from template schema
		let amountInRupees = 400; // safe fallback
		if (templateId) {
			const template = await Template.findOne({ templateId: String(templateId).trim() });
			if (template) {
				let isVendorUser = false;
				if (isVendor) {
					const vendorToken = req.cookies?.vendorAccessToken;
					if (vendorToken) {
						try {
							const decoded = jwt.verify(vendorToken, process.env.JWT_SECRET);
							if (decoded.id) {
								const dbUser = await User.findById(decoded.id);
								if (dbUser && dbUser.role === 'vendor') {
									isVendorUser = true;
									req.user = decoded;
								}
							}
						} catch (e) {}
					}
				}

				if (!isVendorUser && req.user?.id) {
					const dbUser = await User.findById(req.user.id);
					if (dbUser && dbUser.role === 'vendor') {
						isVendorUser = true;
					}
				}

				if (isVendorUser && template.vendorPrice !== undefined && template.vendorPrice >= 0) {
					amountInRupees = template.vendorPrice;
				} else if (template.sellPrice > 0) {
					amountInRupees = template.sellPrice;
				}
			}
		}
		const amount = Math.max(1, amountInRupees) * 100; // convert to paise

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
			isVendor,
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

		if (isVendor) {
			const vendorToken = req.cookies?.vendorAccessToken;
			if (vendorToken) {
				try {
					const decoded = jwt.verify(vendorToken, process.env.JWT_SECRET);
					if (decoded.id) {
						const dbUser = await User.findById(decoded.id);
						if (dbUser && dbUser.role === 'vendor') {
							req.user = decoded;
						}
					}
				} catch (e) {}
			}
		}

		const creatorId = req.user?.id || invitationData.createdBy || invitationData.creatorId;
		if (!creatorId) {
			return res.status(400).json({ success: false, message: 'User is required to create invitation' });
		}

		const invitationPayload = buildInvitationPayload(invitationData, creatorId, {
			razorpayOrderId: razorpay_order_id,
			razorpayPaymentId: razorpay_payment_id,
			amountPaid: req.body.orderAmount || getInvitationAmountInPaise(),
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
			.select('bride groom createdAt amountPaid paymentStatus razorpayOrderId razorpayPaymentId slug coverImage');

		const mapped = payments.map((p) => ({
			id: p._id,
			couple: [p.bride, p.groom].filter(Boolean).join(' & '),
			date: p.createdAt,
			amount: p.amountPaid || 0,
			status: p.paymentStatus || 'unknown',
			razorpayOrderId: p.razorpayOrderId || null,
			razorpayPaymentId: p.razorpayPaymentId || null,
			inviteSlug: p.slug || null,
			coverImage: p.coverImage || null,
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
		const creatorId = String(invitation.createdBy?._id || invitation.createdBy);
		if (creatorId !== String(userId)) {
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

		// Top Gold Accent Bar
		doc.rect(48, 30, doc.page.width - 96, 4).fill('#c8a24c');

		// 1. Logo or brand text in header
		if (hasLogo) {
			doc.image(logoPath, 48, 55, { height: 40 });
		} else {
			doc.fillColor('#7d2432').font('Helvetica-Bold').fontSize(22).text('EnviteYou', 48, 55);
		}
		doc.fillColor('#6b7280').font('Helvetica').fontSize(9.5).text('Digital Invitation Platform', 48, 102);

		// 2. Invoice Details (Header Right)
		doc.fillColor('#111827').font('Helvetica-Bold').fontSize(24).text('INVOICE', 350, 52, { align: 'right', width: 200 });
		doc.fillColor('#4b5563').font('Helvetica').fontSize(9).text(`Invoice No: ${invoiceNo}`, 350, 80, { align: 'right', width: 200 });
		doc.text(`Date: ${new Date(invitation.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 350, 93, { align: 'right', width: 200 });

		// Divider
		doc.moveTo(48, 125).lineTo(doc.page.width - 48, 125).strokeColor('#e5e7eb').lineWidth(1).stroke();

		// 3. Sender / Billed To / Details Columns
		doc.fillColor('#9ca3af').font('Helvetica-Bold').fontSize(7.5).text('FROM', 48, 145);
		doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10.5).text('EnviteYou Studios', 48, 158);
		doc.fillColor('#4b5563').font('Helvetica').fontSize(9).text('Wedding Invitation Services', 48, 172);
		doc.text('support@enviteyou.com', 48, 184);
		doc.text('www.enviteyou.com', 48, 196);

		doc.fillColor('#9ca3af').font('Helvetica-Bold').fontSize(7.5).text('BILLED TO', 230, 145);
		doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10.5).text(invitation.createdBy?.name || 'Valued Customer', 230, 158);
		doc.fillColor('#4b5563').font('Helvetica').fontSize(9).text(invitation.createdBy?.email || '', 230, 172);

		doc.fillColor('#9ca3af').font('Helvetica-Bold').fontSize(7.5).text('PAYMENT DETAILS', 400, 145);
		doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9.5).text('Status:', 400, 158);
		const isPaid = String(invitation.paymentStatus || 'paid').toLowerCase() === 'paid';
		doc.fillColor(isPaid ? '#059669' : '#d97706').font('Helvetica-Bold').fontSize(10).text(isPaid ? 'PAID' : 'PENDING', 445, 158);
		doc.fillColor('#4b5563').font('Helvetica').fontSize(9).text(`Order ID: ${invitation.razorpayOrderId || 'N/A'}`, 400, 172);
		doc.text(`Payment ID: ${invitation.razorpayPaymentId || 'N/A'}`, 400, 184);

		// 4. Line Items Table
		const tableTop = 230;
		// Header background
		doc.rect(48, tableTop, doc.page.width - 96, 24).fill('#111827');
		doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
		doc.text('ITEM DESCRIPTION', 58, tableTop + 8);
		doc.text('REFERENCE ID', 350, tableTop + 8);
		doc.text('AMOUNT', 467, tableTop + 8, { width: 70, align: 'right' });

		// Item Row
		const rowY = tableTop + 24;
		doc.rect(48, rowY, doc.page.width - 96, 36).fill('#f9fafb');
		doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(9.5).text(`Premium Digital Invitation (${couple})`, 58, rowY + 13, { width: 280 });
		doc.fillColor('#4b5563').font('Helvetica').fontSize(9).text(invitation.razorpayPaymentId || 'N/A', 350, rowY + 13);
		doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(10).text(`INR ${amount.toFixed(2)}`, 467, rowY + 13, { width: 70, align: 'right' });

		// Bottom line of table
		doc.moveTo(48, rowY + 36).lineTo(doc.page.width - 48, rowY + 36).strokeColor('#e5e7eb').lineWidth(1).stroke();

		// 5. Info Box (Left) and Price Box (Right)
		const summaryTop = rowY + 56;
		
		// Info Box (Left)
		doc.roundedRect(48, summaryTop, 270, 78, 6).fill('#f9fafb');
		doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(8).text('INVITATION CONFIGURATION', 58, summaryTop + 10);
		doc.font('Helvetica').fontSize(8.5).text(`Slug: ${invitation.slug}`, 58, summaryTop + 24, { width: 250 });
		doc.fillColor('#4b5563').text(`Link: `, 58, summaryTop + 38);
		doc.fillColor('#7d2432').text(inviteUrl, 82, summaryTop + 38, { width: 226, link: inviteUrl, underline: true });
		doc.fillColor('#059669').font('Helvetica-Bold').text('Payment verified via Razorpay.', 58, summaryTop + 56);

		// Price Summary (Right)
		doc.fillColor('#4b5563').font('Helvetica').fontSize(9.5).text('Subtotal', 350, summaryTop);
		doc.fillColor('#1f2937').font('Helvetica-Bold').text(`INR ${amount.toFixed(2)}`, 467, summaryTop, { width: 70, align: 'right' });
		
		doc.fillColor('#4b5563').font('Helvetica').fontSize(9.5).text('GST (0%)', 350, summaryTop + 18);
		doc.fillColor('#1f2937').font('Helvetica-Bold').text('INR 0.00', 467, summaryTop + 18, { width: 70, align: 'right' });

		doc.moveTo(350, summaryTop + 34).lineTo(doc.page.width - 48, summaryTop + 34).strokeColor('#e5e7eb').lineWidth(0.5).stroke();

		// Grand Total Box
		doc.rect(340, summaryTop + 42, 207, 36).fill('#f0fdfa');
		doc.fillColor('#0f766e').font('Helvetica-Bold').fontSize(11).text('Total Paid', 350, summaryTop + 54);
		doc.fontSize(13).text(`INR ${amount.toFixed(2)}`, 457, summaryTop + 53, { width: 80, align: 'right' });

		// 6. Terms & Notes
		const notesTop = summaryTop + 105;
		doc.fillColor('#9ca3af').font('Helvetica-Bold').fontSize(7.5).text('TERMS & NOTES', 48, notesTop);
		doc.fillColor('#6b7280').font('Helvetica').fontSize(8.5).text('1. This invoice is system-generated and serves as official proof of payment for digital services.\n2. All invitations are hosted securely on EnviteYou platform under your active subscription.\n3. For any billing questions or support, please email support@enviteyou.com.', 48, notesTop + 14, { lineHeight: 12 });

		// 7. Footer
		doc.moveTo(48, doc.page.height - 60).lineTo(doc.page.width - 48, doc.page.height - 60).strokeColor('#f3f4f6').lineWidth(1).stroke();
		doc.fillColor('#9ca3af').font('Helvetica-Bold').fontSize(8).text('THANK YOU FOR YOUR BUSINESS', 48, doc.page.height - 48, { align: 'center', width: doc.page.width - 96 });

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
