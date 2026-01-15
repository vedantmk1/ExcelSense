function openPopup() {
    document.getElementById("popup").style.display = "block";
}

function closePopup() {
    document.getElementById("popup").style.display = "none";
}
function toggleTheme() {
    const toggle = document.getElementById("themeToggle");

    if (toggle.checked) {
        document.body.classList.add("dark");
        localStorage.setItem("theme", "dark");
    } else {
        document.body.classList.remove("dark");
        localStorage.setItem("theme", "light");
    }
}

/* Persist theme */
window.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem("theme");
    const toggle = document.getElementById("themeToggle");

    if (savedTheme === "dark") {
        document.body.classList.add("dark");
        toggle.checked = true;
    }
});
