export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST requests are allowed' });
    }

    const { ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID } = process.env;

    try {
        const response = await fetch('https://zoom.us/oauth/token', {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'account_credentials',
                account_id: ZOOM_ACCOUNT_ID,
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
