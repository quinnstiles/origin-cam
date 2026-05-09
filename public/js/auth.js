let isRegister = false;

function toggleMode() {
    isRegister = !isRegister;

    document.getElementById("title").innerText =
        isRegister ? "Register" : "Login";

    document.getElementById("name").style.display =
        isRegister ? "block" : "none";
}

async function submitAuth() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const name = document.getElementById("name").value;

    const payload = isRegister
        ? {
            type: "register",
            email,
            password,
            name
        }
        : {
            type: "login",
            email,
            password
        };

    const res = await apiPost("/auth", payload);

    if (res.error) {
        alert(res.error);
        return;
    }

    if (!isRegister) {
        localStorage.setItem("token", res.token);
        window.location.href = "/profile.html";
    } else {
        alert("Registered! Now login.");
        toggleMode();
    }
}