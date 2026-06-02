import User from '../models/user.js';
import dns from 'node:dns';
import nodemailer from 'nodemailer';

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
    auth: {
      user: user,
      pass: pass,
    },
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, { ...options, family: 4 }, callback);
    },
  });
};

const sendVendorApprovalEmail = async (vendor) => {
  try {
    const transporter = createMailTransport();
    const appUrl = process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
    const businessName = vendor.businessName || vendor.name || 'your business';

    await transporter.sendMail({
      from: process.env.EMAIL_USER?.trim(),
      to: vendor.email,
      subject: 'Your EnviteYou vendor account has been approved',
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>Hello ${vendor.name || 'Vendor'},</p>
        <p>Your vendor account for <strong>${businessName}</strong> has been approved by our admin team.</p>
        <p>You can now sign in to your vendor dashboard and continue managing your account.</p>
        <p>
          <a href="${appUrl}/vendor/signin" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;">Sign in to vendor dashboard</a>
        </p>
        <p>Thank you,<br/>EnviteYou Team</p>
      </div>
    `,
    });
  } catch (error) {
    console.error('Failed to send vendor approval email:', error.message);
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getUsersCount = async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getVendors = async (req, res) => {
  try {
    const vendors = await User.find({ role: 'vendor' }).select('-password');
    res.status(200).json(vendors);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateVendorAuthentication = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVendorAuthenticate } = req.body;

    const vendor = await User.findOne({ _id: id, role: 'vendor' });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found', success: false });
    }

    const shouldNotifyApproval = Boolean(isVendorAuthenticate) && !vendor.isVendorAuthenticate;

    vendor.isVendorAuthenticate = Boolean(isVendorAuthenticate);
    await vendor.save();

    if (shouldNotifyApproval) {
      try {
        await sendVendorApprovalEmail(vendor);
      } catch (mailError) {
        console.error('Vendor approval email failed:', mailError.message);
      }
    }

    const safeVendor = await User.findById(vendor._id).select('-password');
    return res.status(200).json({ message: 'Vendor status updated', success: true, vendor: safeVendor });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', success: false });
  }
};
