import sgMail from '@sendgrid/mail';
import { NextApiRequest, NextApiResponse } from 'next';

sgMail.setApiKey(process.env.SENDGRID_API_KEY as string)

type EmailData = {
    to: string
    template_id: string
    first_name: string
    register_link: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" })
    }

    const { to, template_id, first_name, register_link }: EmailData = req.body
  
    const msg: sgMail.MailDataRequired = {
        personalizations: [
            {
              to: [{ email: to }],
              dynamicTemplateData: {
                first_name: first_name,
                register_link: register_link,
              },
            },
          ],
        from: "contactasae@apoyoconsultoria.com",
        templateId: template_id       
    }
  
    try {
        await sgMail.send(msg)
        res.status(200).json({ message: "Email sent successfully" })
      } catch (error) {
        console.error("Error sending email:", error)
        res.status(500).json({ message: "Error sending email" })
      }
}