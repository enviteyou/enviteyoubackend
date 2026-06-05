import Enquiry from "../models/enquiry.js";
import nodemailer from "nodemailer";

const createMailTransport = () => {
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim();

  if (!user || !pass) {
    throw new Error("Email credentials are not configured in environment variables");
  }

  return nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 2525,
    secure: false,      // port 587 uses STARTTLS, NOT SSL
    requireTLS: true,   // enforce STARTTLS upgrade
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
};

const sendEnquiryEmails = async (enquiryData) => {
  try {
    const transporter = createMailTransport();
    const { name, email, number, enquiry } = enquiryData;

    // Send confirmation to the sender (customer)
    await transporter.sendMail({
      from: `"EnviteYou" <theenviteyou@gmail.com>`,
      to: email,
      subject: "We have received your enquiry! - EnviteYou",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background-color: #74313d; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; tracking-wide">Thank You for Contacting Us</h1>
          </div>
          <div style="padding: 24px; background-color: #ffffff;">
            <p style="font-size: 16px; margin-top: 0;">Hello <strong>${name}</strong>,</p>
            <p>Thank you for reaching out to EnviteYou. We have successfully received your enquiry and our team will get in touch with you shortly.</p>
            
            <div style="background-color: #f9fafb; padding: 18px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #74313d;">
              <h3 style="margin-top: 0; color: #74313d; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Your Submission Details</h3>
              <p style="margin: 4px 0; font-size: 14px;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>Contact Number:</strong> ${number}</p>
              <p style="margin: 8px 0 0 0; font-size: 14px;"><strong>Message:</strong><br/><span style="color: #4b5563; font-style: italic;">"${enquiry}"</span></p>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">If you have any urgent questions, please feel free to reply directly to this email.</p>
          </div>
          <div style="background-color: #f3f4f6; padding: 16px; text-align: center; border-t: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
            © 2026 EnviteYou. All rights reserved.
          </div>
        </div>
      `,
    });

    // Send notification to the receiver (admin)
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "theenviteyou@gmail.com";
    await transporter.sendMail({
      from: `"EnviteYou Enquiries" <theenviteyou@gmail.com>`,
      to: adminEmail,
      subject: `New Customer Enquiry from ${name} - EnviteYou`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
          <h2 style="color: #74313d; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px; margin-top: 0;">New Enquiry Form Submission</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 140px; color: #4b5563;">Name:</td>
              <td style="padding: 8px 0;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Phone Number:</td>
              <td style="padding: 8px 0;">${number}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563; vertical-align: top;">Enquiry Msg:</td>
              <td style="padding: 8px 0; white-space: pre-wrap; background: #f9fafb; padding: 10px; border-radius: 6px;">${enquiry}</td>
            </tr>
          </table>
          <p style="margin-top: 25px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 15px; text-align: center;">
            This email was generated automatically from the contact form.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send enquiry emails:", error.message);
  }
};

export const createEnquiry = async (req, res) => {
  try {
    const { name, email, number, enquiry } = req.body;

    if (!name || !email || !number || !enquiry) {
      return res.status(400).json({ success: false, message: "All form fields are required" });
    }

    const newEnquiry = await Enquiry.create({
      name,
      email,
      number,
      enquiry,
    });

    // Send emails asynchronously
    sendEnquiryEmails(newEnquiry).catch((err) => {
      console.error("Async email dispatch error:", err);
    });

    return res.status(201).json({
      success: true,
      message: "Enquiry submitted successfully",
      data: newEnquiry,
    });
  } catch (error) {
    console.error("Error creating enquiry:", error.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getEnquiries = async (_req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    return res.status(200).json(enquiries);
  } catch (error) {
    console.error("Error retrieving enquiries:", error.message);
    return res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

export const deleteEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found", success: false });
    }
    return res.status(200).json({ message: "Enquiry deleted successfully", success: true, data: enquiry });
  } catch (error) {
    console.error("Error deleting enquiry:", error.message);
    return res.status(500).json({ message: "Internal Server Error", success: false });
  }
};
