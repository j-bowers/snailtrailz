// Function to detect the OS and device type
function detectOS() {
    let userAgent = window.navigator.userAgent;
    let platform = window.navigator.platform;
    let os = null;
    let deviceType = "Desktop"; // Default to Desktop

    // Detect Operating System
    if (platform.indexOf("Win") !== -1) {
        os = "Windows";
    } else if (platform.indexOf("Mac") !== -1) {
        os = "MacOS";
    } else if (platform.indexOf("Linux") !== -1) {
        os = "Linux";
    } else if (/Android/.test(userAgent)) {
        os = "Android";
        deviceType = "Mobile";
    } else if (/iPhone|iPad|iPod/.test(userAgent)) {
        os = "iOS";
        deviceType = "Mobile";
    } else {
        os = "Unknown";
    }

    // Check if the device is a mobile device by userAgent
    if (/Mobi|Android|iPhone|iPad|iPod/.test(userAgent)) {
        deviceType = "Mobile";
    }

    return { os, deviceType };
}

// Function to fetch IP address using an external API
async function fetchIPAddress() {
    try {
        let response = await fetch('https://api.ipify.org?format=json');
        let data = await response.json();
        return data.ip;
    } catch (error) {
        console.error("Error fetching IP address:", error);
        return "Error fetching IP";
    }
}

// Function to display system information
async function displaySystemInfo() {
    // Get OS and device type
    let osInfo = detectOS();
    
    // Fetch IP address
    let ipAddress = await fetchIPAddress();

    // Display information in HTML
    document.getElementById("ip-address").textContent = ipAddress;
    document.getElementById("os").textContent = osInfo.os;
    document.getElementById("os-version").textContent = navigator.appVersion;
    document.getElementById("device-type").textContent = osInfo.deviceType;
}

// Run the display function when the page loads
displaySystemInfo();
