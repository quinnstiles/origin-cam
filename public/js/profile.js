window.onload = async () => {
    const token = localStorage.getItem("token");

    const res = await apiPost("/profile", { token });

    if (!res.success) {
        window.location.href = "/auth.html";
        return;
    }

    document.getElementById("user").innerText = res.user;
    document.getElementById("time").innerText = "Time: " + res.seconds;
};

function logout() {
    localStorage.removeItem("token");
    window.location.href = "/auth.html";
}