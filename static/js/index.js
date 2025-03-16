// File: static/js/index.js

document.addEventListener('DOMContentLoaded', function () {
    // Initialize particles background
    tsParticles.load("tsparticles", {
        fpsLimit: 60,
        particles: {
            number: {
                value: 40,
                density: {
                    enable: true,
                    value_area: 800
                }
            },
            color: {
                value: "#3b82f6"
            },
            shape: {
                type: "circle",
            },
            opacity: {
                value: 0.2,
                random: true,
            },
            size: {
                value: 3,
                random: true,
            },
            move: {
                enable: true,
                speed: 0.5,
                direction: "none",
                random: true,
                out_mode: "out",
            },
        },
        interactivity: {
            detect_on: "canvas",
            events: {
                onhover: {
                    enable: true,
                    mode: "bubble"
                },
                resize: true
            },
            modes: {
                bubble: {
                    distance: 100,
                    size: 5,
                    duration: 2,
                    opacity: 0.8,
                }
            }
        },
        retina_detect: true
    });

    // Mobile Menu Toggle
    const menuToggle = document.querySelector('.md\\:hidden');
    const mobileMenu = document.querySelector('.fixed.inset-0.bg-darkBg');
    const closeMenuBtn = document.querySelector('.fixed.inset-0.bg-darkBg button');

    if (menuToggle && mobileMenu && closeMenuBtn) {
        menuToggle.addEventListener('click', function () {
            mobileMenu.classList.remove('hidden');
            mobileMenu.classList.add('flex');
        });

        closeMenuBtn.addEventListener('click', function () {
            mobileMenu.classList.remove('flex');
            mobileMenu.classList.add('hidden');
        });
    }

    // Clear Email Text
    const clearBtn = document.getElementById('clear-btn');
    const emailText = document.getElementById('emailText');

    if (clearBtn && emailText) {
        clearBtn.addEventListener('click', function () {
            emailText.value = '';
        });
    }

    // Modal Control
    const resultModal = document.getElementById('result-modal');
    const closeModalBtns = document.querySelectorAll('#close-modal, #close-modal-btn');

    if (closeModalBtns.length > 0 && resultModal) {
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', function () {
                resultModal.classList.add('animate__fadeOut');
                setTimeout(() => {
                    resultModal.classList.remove('animate__fadeOut');
                    resultModal.classList.add('hidden');
                    resultModal.classList.remove('animate__fadeIn');
                }, 500);
            });
        });
    }
});

// Function to predict email
async function predictEmail() {
    const emailText = document.getElementById('emailText').value.trim();
    const resultModal = document.getElementById('result-modal');
    const analysisProgress = document.getElementById('analysis-progress');
    const resultMain = document.getElementById('result-main');
    const resultAnimation = document.getElementById('result-animation');
    const resultMessage = document.getElementById('result-message');
    const resultDescription = document.getElementById('result-description');
    const modalHeader = document.getElementById('modal-header');
    const resultIcon = document.getElementById('result-icon');
    const resultTitle = document.getElementById('result-title');

    // Validate input
    if (!emailText) {
        alert('กรุณาวางข้อความอีเมลก่อน');
        return;
    }

    // Show modal with loading state
    resultModal.classList.remove('hidden');
    resultModal.classList.add('animate__fadeIn');

    // Set initial loading state
    analysisProgress.style.display = 'block';
    resultAnimation.innerHTML = '<span class="text-3xl animate-pulse">⏳</span>';
    resultMessage.textContent = 'กำลังวิเคราะห์...';
    resultDescription.textContent = 'โปรดรอสักครู่ขณะที่เราตรวจสอบอีเมลของคุณ';
    resultIcon.textContent = '⏳';
    resultTitle.textContent = 'กำลังวิเคราะห์';

    // Simulate progress (in a real app, this would be based on actual progress)
    let progress = 0;
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('#analysis-progress span:last-child');

    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 95) {
            progress = 95;
            clearInterval(progressInterval);
        }
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
    }, 300);

    try {
        // Make API call to the backend
        const response = await fetch('/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email_text: emailText }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();

        // Complete progress animation
        clearInterval(progressInterval);
        progress = 100;
        progressBar.style.width = '100%';
        progressText.textContent = '100%';

        // Hide progress after a moment
        setTimeout(() => {
            analysisProgress.style.display = 'none';

            // Update UI with results
            updateResultUI(result);
        }, 500);

    } catch (error) {
        console.error('Error:', error);

        // Show error state
        clearInterval(progressInterval);
        analysisProgress.style.display = 'none';
        resultAnimation.innerHTML = '<i class="fas fa-exclamation-circle text-red-500 text-4xl"></i>';
        resultMessage.textContent = 'เกิดข้อผิดพลาด';
        resultDescription.textContent = 'ไม่สามารถวิเคราะห์อีเมลได้ กรุณาลองอีกครั้ง';
        resultIcon.textContent = '❌';
        resultTitle.textContent = 'เกิดข้อผิดพลาด';
    }
}

function updateResultUI(result) {
    // Get UI elements
    const resultAnimation = document.getElementById('result-animation');
    const resultMessage = document.getElementById('result-message');
    const resultDescription = document.getElementById('result-description');
    const resultIcon = document.getElementById('result-icon');
    const resultTitle = document.getElementById('result-title');
    const modalHeader = document.getElementById('modal-header');

    // Update risk score
    const riskScoreElement = document.querySelector('.bg-gradient-to-r.from-green-500.to-yellow-500');
    const riskScoreText = document.querySelector('.ml-3.font-bold.text-white');

    // Parse the risk percentage from string and remove % sign
    const riskPercentage = parseFloat(result.Risk);

    if (riskScoreElement && riskScoreText) {
        riskScoreElement.style.width = result.Risk;
        riskScoreText.textContent = result.Risk;

        // Change the gradient based on risk level
        if (riskPercentage < 40) {
            riskScoreElement.classList.remove('from-green-500', 'to-yellow-500', 'from-yellow-500', 'to-red-500');
            riskScoreElement.classList.add('from-green-500', 'to-green-300');
        } else if (riskPercentage < 70) {
            riskScoreElement.classList.remove('from-green-500', 'to-green-300', 'from-yellow-500', 'to-red-500');
            riskScoreElement.classList.add('from-green-500', 'to-yellow-500');
        } else {
            riskScoreElement.classList.remove('from-green-500', 'to-green-300', 'from-green-500', 'to-yellow-500');
            riskScoreElement.classList.add('from-yellow-500', 'to-red-500');
        }
    }
    // Update language detection info
    const detectedLanguage = document.getElementById('detected-language');
    const translationBox = document.getElementById('translation-box');
    const translationText = document.getElementById('translation-text');

    if (detectedLanguage) {
        const languageNames = {
            'en': 'อังกฤษ',
            'th': 'ไทย',
            'zh-cn': 'จีน',
            'ja': 'ญี่ปุ่น',
            'ko': 'เกาหลี',
            'fr': 'ฝรั่งเศส',
            'de': 'เยอรมัน',
            'es': 'สเปน',
            'pt': 'โปรตุเกส',
            'it': 'อิตาลี',
            'ru': 'รัสเซีย',
            'ar': 'อาหรับ',
            'hi': 'ฮินดี',
            'unknown': 'ไม่ทราบ'
        };

        detectedLanguage.textContent = languageNames[result.original_language] || result.original_language;
    }

    if (translationBox && translationText) {
        if (result.original_language !== 'en' && result.translated_text !== 'N/A') {
            translationBox.style.display = 'block';
            translationText.textContent = result.translated_text;
        } else {
            translationBox.style.display = 'none';
        }
    }

    // Update URL analysis
    const urlList = document.getElementById('url-list');

    if (urlList) {
        urlList.innerHTML = '';

        if (result.urls_found && result.urls_found.length > 0) {
            result.urls_found.forEach(url => {
                const isMalicious = result.malicious_urls.includes(url);
                const urlItem = document.createElement('div');
                urlItem.className = `p-2 ${result.urls_found.indexOf(url) < result.urls_found.length - 1 ? 'border-b border-gray-700/50' : ''} flex items-center justify-between`;

                const urlContent = `
                    <div class="flex items-center gap-2">
                        <i class="fas fa-${isMalicious ? 'exclamation-triangle text-red-500' : 'check-circle text-green-500'}"></i>
                        <span class="text-gray-300">${url}</span>
                    </div>
                    <span class="${isMalicious ? 'text-red-500 bg-red-500/20' : 'text-green-500 bg-green-500/20'} text-xs px-2 py-0.5 rounded-full">
                        ${isMalicious ? 'อันตราย' : 'ปลอดภัย'}
                    </span>
                `;

                urlItem.innerHTML = urlContent;
                urlList.appendChild(urlItem);
            });
        } else {
            urlList.innerHTML = '<div class="p-2 text-gray-400">ไม่พบ URL ในอีเมลนี้</div>';
        }
    }

    // Update risk factors
    const riskList = document.getElementById('risk-list');

    if (riskList) {
        riskList.innerHTML = '';

        if (riskPercentage > 50 || (result.malicious_urls && result.malicious_urls.length > 0)) {
            let riskFactors = [];

            if (result.malicious_urls && result.malicious_urls.length > 0) {
                riskFactors.push({
                    icon: 'fas fa-link text-red-500',
                    title: 'URL อันตราย',
                    description: 'พบลิงก์ที่อาจเป็นอันตรายในอีเมลนี้'
                });
            }

            if (riskPercentage > 70) {
                riskFactors.push({
                    icon: 'fas fa-exclamation-circle text-red-500',
                    title: 'การหลอกลวงด้านวิศวกรรมสังคม',
                    description: 'อีเมลนี้มีลักษณะของการหลอกลวงทางวิศวกรรมสังคม'
                });
            }

            if (riskPercentage > 50) {
                riskFactors.push({
                    icon: 'fas fa-exclamation-circle text-yellow-500',
                    title: 'ภาษาหลอกลวง',
                    description: 'พบการใช้ภาษาที่มุ่งสร้างความเร่งด่วนหรือความกดดัน'
                });
            }

            if (riskFactors.length === 0) {
                riskFactors.push({
                    icon: 'fas fa-exclamation-circle text-yellow-500',
                    title: 'ความเสี่ยงทั่วไป',
                    description: 'อีเมลนี้มีความเสี่ยงที่อาจเป็นการหลอกลวง'
                });
            }

            riskFactors.forEach((factor, index) => {
                const factorItem = document.createElement('div');
                factorItem.className = `flex items-start gap-2 ${index < riskFactors.length - 1 ? 'mb-2 pb-2 border-b border-gray-700/50' : ''}`;

                const factorContent = `
                    <i class="${factor.icon} mt-0.5"></i>
                    <div>
                        <p class="text-white font-medium">${factor.title}</p>
                        <p class="text-gray-400">${factor.description}</p>
                    </div>
                `;

                factorItem.innerHTML = factorContent;
                riskList.appendChild(factorItem);
            });
        } else {
            const safeMessage = document.createElement('div');
            safeMessage.className = "flex items-start gap-2";
            safeMessage.innerHTML = `
                <i class="fas fa-check-circle text-green-500 mt-0.5"></i>
                <div>
                    <p class="text-white font-medium">อีเมลปลอดภัย</p>
                    <p class="text-gray-400">ไม่พบปัจจัยเสี่ยงที่บ่งชี้ว่าเป็นอีเมลหลอกลวง</p>
                </div>
            `;
            riskList.appendChild(safeMessage);
        }
    }

    // Update main result display
    if (result.prediction.includes("Social Engineering")) {
        // Phishing detected
        resultAnimation.innerHTML = '<i class="fas fa-exclamation-triangle text-red-500 text-4xl animate-pulse"></i>';
        resultMessage.textContent = 'ตรวจพบการหลอกลวง!';
        resultDescription.textContent = 'อีเมลนี้มีลักษณะของการหลอกลวงทางวิศวกรรมสังคม';
        resultIcon.textContent = '⚠️';
        resultTitle.textContent = 'ตรวจพบการหลอกลวง';
        modalHeader.classList.add('bg-red-900/30');

        // Add red top border to the result main box
        resultMain.querySelector('.absolute').classList.remove('from-green-500');
        resultMain.querySelector('.absolute').classList.add('from-red-500', 'to-red-800');

    } else {
        // Normal email
        resultAnimation.innerHTML = '<i class="fas fa-check-circle text-green-500 text-4xl"></i>';
        resultMessage.textContent = 'อีเมลปลอดภัย';
        resultDescription.textContent = 'ไม่พบลักษณะของการหลอกลวงในอีเมลนี้';
        resultIcon.textContent = '✅';
        resultTitle.textContent = 'ผลการวิเคราะห์';
        modalHeader.classList.remove('bg-red-900/30');

        // Add green top border to the result main box
        resultMain.querySelector('.absolute').classList.remove('from-red-500', 'to-red-800');
        resultMain.querySelector('.absolute').classList.add('from-green-500');
    }
}