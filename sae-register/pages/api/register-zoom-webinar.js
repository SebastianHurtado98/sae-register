export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST requests are allowed' });
    }

    const { webinarId, firstName, lastName, email, token, org } = req.body;

    if (!webinarId || !firstName || !lastName || !email || !token || !org) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const ZOOM_API_URL = `https://api.zoom.us/v2/webinars/${webinarId}/registrants`;

    try {
        const response = await fetch(ZOOM_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                first_name: firstName,
                last_name: lastName,
                email: email,
                org: org,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            return res.status(response.status).json({ message: error.message });
        }

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
