const API_BASE = "/api";

async function apiPost(url, data) {
    const res = await fetch(API_BASE + url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    return res.json();
}