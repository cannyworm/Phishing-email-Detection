async function predictEmail() {
    const emailText = document.getElementById("emailText").value;
    const analyzeBtn = document.getElementById("analyze-btn");
    const buttonIcon = document.getElementById("button-icon");
    const buttonText = document.getElementById("button-text");
    const resultModal = document.getElementById("result-modal");
    const modalHeader = document.getElementById("modal-header");
    const resultIcon = document.getElementById("result-icon");
    const resultTitle = document.getElementById("result-title");
    const resultAnimation = document.getElementById("result-animation");
    const resultMessage = document.getElementById("result-message");
    const resultDescription = document.getElementById("result-description");
    const urlAnalysis = document.getElementById("url-analysis");
    const urlListDiv = document.getElementById("url-list");
    const languageAnalysis = document.getElementById("language-analysis");
    const detectedLanguageSpan = document.getElementById("detected-language");
    const showTranslationBtn = document.getElementById("show-translation");
    const translationBox = document.getElementById("translation-box");
    const translationText = document.getElementById("translation-text");
    const riskFactors = document.getElementById("risk-factors");
    const riskList = document.getElementById("risk-list");

    if (!emailText.trim()) {
        alert("Please enter email text for analysis.");
        return;
    }

    // แสดง loading state
    analyzeBtn.disabled = true;
    analyzeBtn.classList.add("bg-gray-600");
    analyzeBtn.classList.remove("bg-accent", "hover:bg-accentHover");
    buttonIcon.textContent = "⏳";
    buttonText.textContent = "Analyzing...";

    // แสดง modal ในโหมด loading
    resultModal.classList.remove("hidden");
    resultModal.classList.add("animate__fadeIn");
    
    // รีเซ็ต modal เป็นสถานะ loading
    modalHeader.className = "p-4 border-b border-gray-700 flex items-center justify-between bg-gray-800";
    resultIcon.textContent = "⏳";
    resultTitle.textContent = "Analysis in Progress";
    resultAnimation.className = "w-20 h-20 flex items-center justify-center rounded-full bg-gray-700 animate-pulse";
    resultAnimation.innerHTML = "<span class='text-3xl'>⏳</span>";
    resultMessage.textContent = "Analyzing...";
    resultDescription.textContent = "Please wait while we scan your email";
    
    // ซ่อนส่วนอื่นๆ
    urlAnalysis.classList.add("hidden");
    languageAnalysis.classList.add("hidden");
    riskFactors.classList.add("hidden");
    translationBox.classList.add("hidden");

    try {
        const response = await fetch("/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email_text: emailText })
        });

        const data = await response.json();

        if (data.error) {
            // กรณีมี error
            modalHeader.className = "p-4 border-b border-gray-700 flex items-center justify-between bg-red-900 bg-opacity-30";
            resultIcon.textContent = "❌";
            resultTitle.textContent = "Error Occurred";
            resultAnimation.className = "w-20 h-20 flex items-center justify-center rounded-full bg-red-900 bg-opacity-30";
            resultAnimation.innerHTML = "<span class='text-3xl'>❌</span>";
            resultMessage.textContent = "Analysis Failed";
            resultMessage.className = "text-xl font-bold text-red-400";
            resultDescription.textContent = data.error;
        } else {
            // กรณีสำเร็จ
            const isPhishing = data.prediction.includes("🚨");
            
            // ตั้งค่าส่วนหัวและผลลัพธ์หลัก
            if (isPhishing) {
                modalHeader.className = "p-4 border-b border-gray-700 flex items-center justify-between bg-red-900 bg-opacity-30";
                resultIcon.textContent = "🚨";
                resultTitle.textContent = "Phishing Detected";
                resultAnimation.className = "w-20 h-20 flex items-center justify-center rounded-full bg-red-900 bg-opacity-30";
                resultAnimation.innerHTML = "<span class='text-3xl animate__animated animate__pulse'>🚨</span>";
                resultMessage.textContent = data.prediction;
                resultMessage.className = "text-xl font-bold text-red-400";
            } else {
                modalHeader.className = "p-4 border-b border-gray-700 flex items-center justify-between bg-green-900 bg-opacity-30";
                resultIcon.textContent = "✅";
                resultTitle.textContent = "Email Appears Safe";
                resultAnimation.className = "w-20 h-20 flex items-center justify-center rounded-full bg-green-900 bg-opacity-30";
                resultAnimation.innerHTML = "<span class='text-3xl'>✅</span>";
                resultMessage.textContent = data.prediction;
                resultMessage.className = "text-xl font-bold text-green-400";
            }
            
            // แสดงข้อมูลความเสี่ยง
            const risk = data.Risk || "No specific risk factors detected";
            resultDescription.textContent = risk;
            
            // แสดง URL analysis ถ้ามี URLs
            if (data.urls_found && data.urls_found.length > 0) {
                urlAnalysis.classList.remove("hidden");
                
                // สร้างรายการ URLs
                let urlHtml = '';
                data.urls_found.forEach(url => {
                    const isMalicious = data.malicious_urls && data.malicious_urls.includes(url);
                    const urlClass = isMalicious ? "text-red-400" : "text-blue-400";
                    const urlIcon = isMalicious ? "🚨" : "🔗";
                    const warningText = isMalicious ? " <span class='text-red-400 font-medium'>(Suspicious)</span>" : "";
                    
                    urlHtml += `<div class="mb-2 break-all flex items-start">
                        <span class="mr-1">${urlIcon}</span>
                        <div>
                            <span class="${urlClass}">${url}</span>
                            ${warningText}
                        </div>
                    </div>`;
                });
                
                urlListDiv.innerHTML = urlHtml || "No URLs found in the email.";
            }
            
            // แสดงข้อมูลภาษา
            if (data.original_language) {
                languageAnalysis.classList.remove("hidden");
                detectedLanguageSpan.textContent = data.original_language;
                
                // ถ้ามีข้อมูลการแปล
                if (data.translated_text && data.translated_text !== "N/A") {
                    showTranslationBtn.classList.remove("hidden");
                    translationText.textContent = data.translated_text;
                    
                    showTranslationBtn.addEventListener("click", function() {
                        translationBox.classList.toggle("hidden");
                        showTranslationBtn.textContent = translationBox.classList.contains("hidden") 
                            ? "Show Translation" 
                            : "Hide Translation";
                    });
                }
            }
            
            // แสดงรายการปัจจัยความเสี่ยง (ถ้ามี)
            if (data.risk_factors && data.risk_factors.length > 0) {
                riskFactors.classList.remove("hidden");
                
                let riskHtml = '<ul class="list-disc list-inside space-y-1">';
                data.risk_factors.forEach(risk => {
                    riskHtml += `<li>${risk}</li>`;
                });
                riskHtml += '</ul>';
                
                riskList.innerHTML = riskHtml;
            } else if (isPhishing) {
                // ถ้าเป็น phishing แต่ไม่มี risk factors, แสดงข้อความ default
                riskFactors.classList.remove("hidden");
                riskList.innerHTML = `<div class="text-yellow-400">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    This email has been flagged as phishing based on our analysis algorithm.
                </div>`;
            }
        }
    } catch (error) {
        // กรณีเกิด error ในการเชื่อมต่อ
        modalHeader.className = "p-4 border-b border-gray-700 flex items-center justify-between bg-red-900 bg-opacity-30";
        resultIcon.textContent = "❌";
        resultTitle.textContent = "Connection Error";
        resultAnimation.className = "w-20 h-20 flex items-center justify-center rounded-full bg-red-900 bg-opacity-30";
        resultAnimation.innerHTML = "<span class='text-3xl'>❌</span>";
        resultMessage.textContent = "Failed to Connect";
        resultMessage.className = "text-xl font-bold text-red-400";
        resultDescription.textContent = "Could not connect to the server. Please check your internet connection and try again.";
        console.error(error);
    } finally {
        // คืนค่าปุ่มกลับสู่สถานะปกติ
        setTimeout(() => {
            analyzeBtn.disabled = false;
            analyzeBtn.classList.remove("bg-gray-600");
            analyzeBtn.classList.add("bg-accent", "hover:bg-accentHover");
            buttonIcon.textContent = "🚀";
            buttonText.textContent = "Analyze Email";
        }, 500);
    }
}

// Event Listeners
document.getElementById('clear-btn').addEventListener('click', function() {
    document.getElementById('emailText').value = '';
    document.getElementById('emailText').focus();
});

document.getElementById('close-modal').addEventListener('click', function() {
    document.getElementById('result-modal').classList.add("animate__fadeOut");
    setTimeout(() => {
        document.getElementById('result-modal').classList.remove("animate__fadeOut");
        document.getElementById('result-modal').classList.add("hidden");
    }, 500);
});

document.getElementById('close-modal-btn').addEventListener('click', function() {
    document.getElementById('result-modal').classList.add("animate__fadeOut");
    setTimeout(() => {
        document.getElementById('result-modal').classList.remove("animate__fadeOut");
        document.getElementById('result-modal').classList.add("hidden");
    }, 500);
});

document.getElementById('copy-result').addEventListener('click', function() {
    const resultMessage = document.getElementById('result-message').textContent;
    const resultDescription = document.getElementById('result-description').textContent;
    
    // Create text to copy
    let copyText = `Analysis Result: ${resultMessage}\n`;
    copyText += `Risk: ${resultDescription}\n`;
    
    // Add URL info if available
    if (!document.getElementById('url-analysis').classList.contains('hidden')) {
        copyText += "\nURLs Detected:\n";
        const urlTexts = document.getElementById('url-list').innerText;
        copyText += urlTexts + "\n";
    }
    
    // Add language info if available
    if (!document.getElementById('language-analysis').classList.contains('hidden')) {
        const language = document.getElementById('detected-language').textContent;
        copyText += `\nOriginal Language: ${language}\n`;
    }
    
    navigator.clipboard.writeText(copyText)
        .then(() => {
            const copyBtn = document.getElementById('copy-result');
            copyBtn.textContent = "Copied!";
            setTimeout(() => {
                copyBtn.textContent = "Copy Results";
            }, 2000);
        })
        .catch(err => {
            console.error('Could not copy text: ', err);
        });
});

document.getElementById('report-button').addEventListener('click', function() {
    alert("Thank you for your feedback! Our team will review this analysis.");
});

window.onload = () => {
    tsParticles.load("tsparticles", {
        particles: {
            number: { value: window.innerWidth < 768 ? 50 : 100, density: { enable: true, value_area: 800 } },
            color: { value: "#ffffff" },
            shape: { type: "circle" },
            opacity: { value: 0.7 },
            size: { value: 2, random: true },
            move: { enable: true, speed: 1, direction: "none", out_mode: "out" }
        },
        interactivity: {
            detect_on: "canvas",
            events: {
                onhover: { enable: true, mode: "repulse" },
                onclick: { enable: true, mode: "push" },
                resize: true,
            },
            modes: {
                repulse: { distance: 100, duration: 0.4 },
                push: { particles_nb: 4 },
            }
        },
        retina_detect: true,
    });
    
    // Focus textarea on page load
    document.getElementById('emailText').focus();
};