document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // UI Elements
    const angleSlider = document.getElementById('angle');
    const powerSlider = document.getElementById('power');
    const angleValueDisplay = document.getElementById('angleValue');
    const powerValueDisplay = document.getElementById('powerValue');
    const launchButton = document.getElementById('launchButton');
    const resetButton = document.getElementById('resetButton');
    const analysisModeButton = document.getElementById('analysisModeButton');
    const gravityDisplay = document.getElementById('gravityDisplay');

    const initialVxDisplay = document.getElementById('initialVxDisplay');
    const initialVyDisplay = document.getElementById('initialVyDisplay');
    const maxHeightDisplay = document.getElementById('maxHeightDisplay');
    const rangeDisplay = document.getElementById('rangeDisplay');
    const timeOfFlightDisplay = document.getElementById('timeOfFlightDisplay');
    const actualMaxHeightDisplay = document.getElementById('actualMaxHeightDisplay');
    const actualRangeDisplay = document.getElementById('actualRangeDisplay');
    const actualTimeOfFlightDisplay = document.getElementById('actualTimeOfFlightDisplay');

    const levelMessageDisplay = document.getElementById('levelMessage');
    const levelInstructionsDisplay = document.getElementById('levelInstructions');
    const vectorInfoDisplay = document.getElementById('vectorInfo');

    const challengeQuestionArea = document.getElementById('challengeQuestionArea');
    const challengeAnswerInput1 = document.getElementById('challengeAnswerInput1');
    const challengeAnswerInput2 = document.getElementById('challengeAnswerInput2');
    const submitChallengeButton = document.getElementById('submitChallengeButton');
    const challengeFeedback = document.getElementById('challengeFeedback');


    // Game Constants & State
    let G = 9.81; // Default gravity
    const timeStep = 0.03; // Simulation time step
    const groundLevel = canvas.height - 40;
    const slingshotX = 80;
    let slingshotY = groundLevel - 30; // Default, can be changed by level

    let projectile = {
        x: slingshotX, y: slingshotY, radius: 8, color: '#FF4500',
        vx: 0, vy: 0, isFlying: false,
        path: [] // Stores {x, y, vx_physics, vy_physics, t}
    };

    let targets = [];
    let currentLevelIndex = 0;
    let isAnalysisMode = false;
    let analysisPoint = null; // Point on path for vector display
    let currentChallenge = null;

    const levelSetups = [
        {
            name: "Level 1: Basic Shot",
            g: 9.81, launchHeight: 30, // above groundLevel base
            targets: [{ x: 500, y: groundLevel - 20, width: 40, height: 40, color: '#2E8B57', hit: false }],
            instructions: "Hit the target. Observe the parabolic path.",
            challenge: {
                type: "calc_initial_components",
                questionText: "Before you launch: If you set angle to 30° and speed to 50 m/s, what are v<sub>x</sub> and v<sub>y</sub>? (Enter v<sub>x</sub>, then v<sub>y</sub>. Round to 1 decimal place)",
                params: { angle: 30, speed: 50 },
                inputs: 2,
                tolerance: 0.2
            }
        },
        {
            name: "Level 2: Max Height",
            g: 9.81, launchHeight: 30,
            targets: [{ x: 350, y: groundLevel - 150, width: 30, height: 30, color: '#3CB371', hit: false }],
            instructions: "This target is high! Consider what happens to v<sub>y</sub> at the peak.",
            challenge: {
                type: "conceptual_max_height_vy",
                questionText: "After your shot: What is the vertical velocity (v<sub>y</sub>) of the projectile at its maximum height?",
                inputs: 1,
                correctAnswer: ["0"]
            }
        },
        {
            name: "Level 3: Moon Shot!",
            g: 1.62, launchHeight: 30, // Moon's gravity
            targets: [{ x: 700, y: groundLevel - 50, width: 50, height: 50, color: '#2E8B57', hit: false }],
            instructions: "You're on the Moon (g = 1.62 m/s²)! How does this affect the trajectory for the same launch settings?",
            challenge: {
                type: "calc_range_time", // Post-launch
                questionText: "After your shot (e.g., 45°, 40m/s): What was the approximate Range and Time of Flight? (Enter Range, then Time. Round to 1 decimal.)",
                inputs: 2,
                tolerance: 5 // Wider tolerance for user observation
            }
        },
        {
            name: "Level 4: Force & Acceleration",
            g: 9.81, launchHeight: 20, // Launched from lower
            targets: [{ x: 400, y: groundLevel - 20, width: 40, height: 40, color: '#2E8B57', hit: false }],
            instructions: "Focus on the forces. Use Analysis Mode after your shot to see the force vector.",
            challenge: {
                type: "conceptual_force_acceleration",
                questionText: "During flight (ignoring air resistance), what is the direction of the net force on the ball? And its acceleration?",
                inputs: 2, // "Downward", "Downward" or "Gravity", "g"
                // This one is harder to auto-grade simply, might need text matching
                correctAnswer: ["downward", "downward"], // Simplified for example
                feedbackText: "Force is gravity (downward). Acceleration is g (downward)."
            }
        },
        // Add more levels based on exam questions (e.g., hitting a target at specific H and V, horizontal launch from table)
    ];

    function loadLevel(levelIdx) {
        currentLevelIndex = levelIdx;
        isAnalysisMode = false;
        analysisPoint = null;
        vectorInfoDisplay.style.display = 'none';

        if (currentLevelIndex >= levelSetups.length) {
            levelMessageDisplay.textContent = "All Levels Completed! Congratulations!";
            launchButton.disabled = true;
            analysisModeButton.disabled = true;
            targets = [];
            currentChallenge = null;
            updateChallengeUI();
            drawGame();
            return;
        }

        const level = levelSetups[currentLevelIndex];
        G = level.g;
        slingshotY = groundLevel - level.launchHeight;
        targets = JSON.parse(JSON.stringify(level.targets)); // Deep copy

        levelMessageDisplay.textContent = level.name;
        levelInstructionsDisplay.textContent = level.instructions;
        gravityDisplay.textContent = G.toFixed(2);

        launchButton.disabled = false;
        analysisModeButton.disabled = true; // Enable after a shot
        analysisModeButton.textContent = "Toggle Analysis Mode";


        currentChallenge = level.challenge ? { ...level.challenge, answered: false, correct: false } : null;
        updateChallengeUI();

        resetProjectileState();
        updatePreLaunchCalculations(); // Show initial calcs for current slider values
        drawGame();
    }

    function resetProjectileState() {
        projectile.isFlying = false;
        projectile.x = slingshotX;
        projectile.y = slingshotY;
        projectile.vx = 0;
        projectile.vy = 0;
        projectile.path = [];
        actualMaxHeightDisplay.textContent = "-";
        actualRangeDisplay.textContent = "-";
        actualTimeOfFlightDisplay.textContent = "-";
    }

    function updatePreLaunchCalculations() {
        const angleRad = parseFloat(angleSlider.value) * Math.PI / 180;
        const v0 = parseFloat(powerSlider.value);

        const v0x = v0 * Math.cos(angleRad);
        const v0y_physics = v0 * Math.sin(angleRad); // Physics y (positive up)

        initialVxDisplay.textContent = v0x.toFixed(2);
        initialVyDisplay.textContent = v0y_physics.toFixed(2);

        // Predictions relative to launch height for simplicity here
        const t_peak = v0y_physics / G;
        const h_max_above_launch = (v0y_physics * v0y_physics) / (2 * G);
        maxHeightDisplay.textContent = h_max_above_launch.toFixed(2);

        const t_flight_to_launch_height = 2 * t_peak;
        const range_to_launch_height = v0x * t_flight_to_launch_height;
        timeOfFlightDisplay.textContent = t_flight_to_launch_height.toFixed(2);
        rangeDisplay.textContent = range_to_launch_height.toFixed(2);

        if (!projectile.isFlying) drawGame();
    }

    angleSlider.addEventListener('input', () => {
        angleValueDisplay.textContent = `${angleSlider.value}°`;
        if (!projectile.isFlying) updatePreLaunchCalculations();
    });
    powerSlider.addEventListener('input', () => {
        powerValueDisplay.textContent = `${powerSlider.value} m/s`;
        if (!projectile.isFlying) updatePreLaunchCalculations();
    });

    launchButton.addEventListener('click', () => {
        if (projectile.isFlying) return;

        const angleRad = parseFloat(angleSlider.value) * Math.PI / 180;
        const initialSpeed = parseFloat(powerSlider.value);

        projectile.vx = initialSpeed * Math.cos(angleRad); // Horizontal component (constant)
        projectile.vy = -initialSpeed * Math.sin(angleRad); // Canvas Y is inverted, so negative for upward
        // Store physics-based vy for path data (positive up)
        let vy_physics_initial = initialSpeed * Math.sin(angleRad);

        projectile.isFlying = true;
        projectile.x = slingshotX;
        projectile.y = slingshotY;
        projectile.path = [{ x: projectile.x, y: projectile.y, vx_physics: projectile.vx, vy_physics: vy_physics_initial, t: 0 }];
        
        analysisModeButton.disabled = true; // Disable during flight
        isAnalysisMode = false;
        analysisPoint = null;
        vectorInfoDisplay.style.display = 'none';

        gameLoop();
    });

    resetButton.addEventListener('click', () => {
        loadLevel(currentLevelIndex);
    });

    analysisModeButton.addEventListener('click', () => {
        if (projectile.isFlying || projectile.path.length === 0) return;
        isAnalysisMode = !isAnalysisMode;
        analysisModeButton.textContent = isAnalysisMode ? "Exit Analysis Mode" : "Toggle Analysis Mode";
        analysisPoint = null; // Reset selected point
        vectorInfoDisplay.style.display = 'none';
        drawGame(); // Redraw to show/hide analysis elements
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isAnalysisMode || projectile.isFlying || projectile.path.length === 0) {
            vectorInfoDisplay.style.display = 'none';
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let closestPoint = null;
        let minDistSq = Infinity;

        projectile.path.forEach(p => {
            const distSq = (p.x - mouseX)**2 + (p.y - mouseY)**2;
            if (distSq < minDistSq && distSq < 400) { // Snap within 20px radius
                minDistSq = distSq;
                closestPoint = p;
            }
        });
        
        analysisPoint = closestPoint;
        if (analysisPoint) {
            vectorInfoDisplay.style.left = `${e.clientX + 15}px`;
            vectorInfoDisplay.style.top = `${e.clientY}px`;
            vectorInfoDisplay.style.display = 'block';
            vectorInfoDisplay.innerHTML = `
                Time: ${analysisPoint.t.toFixed(2)}s<br>
                X: ${analysisPoint.x.toFixed(1)}m, Y (canvas): ${analysisPoint.y.toFixed(1)}m<br>
                v<sub>x</sub>: ${analysisPoint.vx_physics.toFixed(2)} m/s<br>
                v<sub>y</sub> (physics): ${analysisPoint.vy_physics.toFixed(2)} m/s
            `;
        } else {
            vectorInfoDisplay.style.display = 'none';
        }
        drawGame(); // Redraw to highlight point and draw vectors
    });


    function updateChallengeUI() {
        challengeAnswerInput1.style.display = 'none';
        challengeAnswerInput2.style.display = 'none';
        submitChallengeButton.style.display = 'none';
        challengeFeedback.textContent = "";

        if (currentChallenge && !currentChallenge.answered) {
            challengeQuestionArea.innerHTML = `<p>${currentChallenge.questionText}</p>`;
            if (currentChallenge.inputs >= 1) challengeAnswerInput1.style.display = 'inline-block';
            if (currentChallenge.inputs >= 2) challengeAnswerInput2.style.display = 'inline-block';
            submitChallengeButton.style.display = 'block';
        } else if (currentChallenge && currentChallenge.answered) {
            challengeQuestionArea.innerHTML = `<p>${currentChallenge.questionText}</p>`;
            challengeFeedback.textContent = currentChallenge.correct ? "Correct!" : "Incorrect. Try again or review concepts.";
            if (currentChallenge.feedbackText) {
                challengeFeedback.textContent += ` ${currentChallenge.feedbackText}`;
            }
        } else {
            challengeQuestionArea.innerHTML = "<p>No active challenge for this level, or complete flight objective first.</p>";
        }
    }

    submitChallengeButton.addEventListener('click', () => {
        if (!currentChallenge || currentChallenge.answered) return;

        const ans1 = challengeAnswerInput1.value.trim().toLowerCase();
        const ans2 = challengeAnswerInput2.value.trim().toLowerCase();
        let isCorrect = false;

        if (currentChallenge.type === "calc_initial_components") {
            const angleRad = currentChallenge.params.angle * Math.PI / 180;
            const speed = currentChallenge.params.speed;
            const correctVx = (speed * Math.cos(angleRad)).toFixed(1);
            const correctVy = (speed * Math.sin(angleRad)).toFixed(1);
            if (Math.abs(parseFloat(ans1) - parseFloat(correctVx)) <= currentChallenge.tolerance &&
                Math.abs(parseFloat(ans2) - parseFloat(correctVy)) <= currentChallenge.tolerance) {
                isCorrect = true;
            }
        } else if (currentChallenge.type === "conceptual_max_height_vy") {
            if (currentChallenge.correctAnswer.includes(ans1)) isCorrect = true;
        } else if (currentChallenge.type === "calc_range_time") {
            // This requires the student to have run a simulation and then input observed values.
            // For auto-grading, it's tricky without knowing their specific launch.
            // We could compare to the *predicted* if sliders match a certain setting, or make it self-assessment.
            // For now, let's assume if they enter numbers, it's an attempt.
             if (ans1 !== "" && ans2 !== "") {
                challengeFeedback.textContent = "Check your calculations against the 'Actual Flight Results' after a launch.";
                // This challenge is better suited for manual review or specific scenario.
                // For auto-grade, we might need to prescribe a launch or compare to actual flight data.
             }
             // For simplicity in this example, we'll just mark it as attempted.
             currentChallenge.answered = true; // Don't auto-mark correct here.
             updateChallengeUI();
             return;

        } else if (currentChallenge.type === "conceptual_force_acceleration") {
            if (ans1.includes(currentChallenge.correctAnswer[0]) && ans2.includes(currentChallenge.correctAnswer[1])) {
                isCorrect = true;
            }
        }


        currentChallenge.answered = true;
        currentChallenge.correct = isCorrect;
        updateChallengeUI();

        if(isCorrect && targets.every(t => t.hit)) { // If challenge correct AND targets hit
             setTimeout(() => loadLevel(currentLevelIndex + 1), 2000);
        }
    });


    function drawGame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Ground
        ctx.fillStyle = '#228B22';
        ctx.fillRect(0, groundLevel, canvas.width, canvas.height - groundLevel);

        // Draw Slingshot Visual
        ctx.fillStyle = '#8B4513';
        const slingshotVisualHeight = slingshotY - (groundLevel - 50); // Adjust height based on launch point
        ctx.fillRect(slingshotX - 10, groundLevel - 50 , 20, 50); // Post
        ctx.fillRect(slingshotX - 15, slingshotY - 5, 30, 10); // Platform


        targets.forEach(target => {
            ctx.fillStyle = target.hit ? '#A9A9A9' : target.color;
            ctx.fillRect(target.x, target.y, target.width, target.height);
        });

        if (projectile.path.length > 0) { // Draw path if it exists
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(projectile.path[0].x, projectile.path[0].y);
            for (let i = 1; i < projectile.path.length; i++) {
                ctx.lineTo(projectile.path[i].x, projectile.path[i].y);
            }
            ctx.stroke();
        }
        
        // Draw projectile (even if not flying, it sits at slingshot)
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
        ctx.fillStyle = projectile.color;
        ctx.fill();


        // Analysis Mode: Draw vectors at analysisPoint
        if (isAnalysisMode && analysisPoint) {
            ctx.fillStyle = 'yellow'; // Highlight the selected point
            ctx.beginPath();
            ctx.arc(analysisPoint.x, analysisPoint.y, 5, 0, Math.PI*2);
            ctx.fill();

            const p = analysisPoint;
            const scale = 2; // Scale for vector arrows

            // Force Vector (Gravity) - Always downward
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 3;
            drawArrow(ctx, p.x, p.y, p.x, p.y + G * scale * 2, "F_g"); // Increased length for visibility

            // Velocity Vectors
            // v_x (Horizontal)
            ctx.strokeStyle = 'blue';
            drawArrow(ctx, p.x, p.y, p.x + p.vx_physics * scale, p.y, "v_x");

            // v_y (Vertical) - Canvas y is inverted for drawing, but use physics vy for direction
            ctx.strokeStyle = 'green';
            drawArrow(ctx, p.x, p.y, p.x, p.y - p.vy_physics * scale, "v_y"); // p.y - p.vy_physics because canvas Y is down
        }


        // Predictive Trajectory (if not flying and not in analysis mode)
        if (!projectile.isFlying && !isAnalysisMode) {
            const angle = parseFloat(angleSlider.value) * Math.PI / 180;
            const initialSpeed = parseFloat(powerSlider.value);
            let simX = slingshotX;
            let simY = slingshotY;
            let simVx = initialSpeed * Math.cos(angle);
            let simVy_canvas = -initialSpeed * Math.sin(angle); // Canvas Y for drawing

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(simX, simY);
            let t_pred = 0;
            while (simY + projectile.radius < groundLevel + projectile.radius*2 && simX < canvas.width && t_pred < 15) { // Limit prediction
                simVy_canvas += G * timeStep; // gravity affects canvas_vy positively
                simX += simVx * timeStep;
                simY += simVy_canvas * timeStep;
                ctx.lineTo(simX, simY);
                t_pred += timeStep;
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
    
    function drawArrow(context, fromx, fromy, tox, toy, label) {
        const headlen = 8; // length of head in pixels
        const dx = tox - fromx;
        const dy = toy - fromy;
        const angle = Math.atan2(dy, dx);
        context.beginPath();
        context.moveTo(fromx, fromy);
        context.lineTo(tox, toy);
        context.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
        context.moveTo(tox, toy);
        context.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
        context.stroke();
        if (label) {
            context.fillStyle = context.strokeStyle;
            context.font = "bold 12px Arial";
            let labelX = tox + 5;
            let labelY = toy + 5;
            if (label === "F_g") { labelY = toy + 15; labelX = tox -15; }
            if (label === "v_x") { labelX = tox + 10; }
            if (label === "v_y") { labelY = toy - 10; }
            context.fillText(label, labelX, labelY);
        }
    }


    function updateGameState() {
        if (!projectile.isFlying) return;

        let currentTime = projectile.path[projectile.path.length - 1].t + timeStep;
        let prev_vy_physics = projectile.path[projectile.path.length - 1].vy_physics;

        // Update physics vertical velocity
        let current_vy_physics = prev_vy_physics - G * timeStep; // vy decreases (becomes more negative if going up)

        // Update canvas vertical velocity (vy for drawing)
        projectile.vy += G * timeStep; // Canvas vy increases (downwards)

        projectile.x += projectile.vx * timeStep; // vx is projectile.vx (constant horizontal)
        projectile.y += projectile.vy * timeStep; // vy is canvas vertical velocity
        
        projectile.path.push({ x: projectile.x, y: projectile.y, vx_physics: projectile.vx, vy_physics: current_vy_physics, t: currentTime });

        // Collision with ground
        if (projectile.y + projectile.radius > groundLevel) {
            projectile.y = groundLevel - projectile.radius;
            projectile.isFlying = false;
            analysisModeButton.disabled = false;
            updateActualFlightStats();
            checkLevelCompletion();
        }

        targets.forEach(target => {
            if (!target.hit &&
                projectile.x + projectile.radius > target.x &&
                projectile.x - projectile.radius < target.x + target.width &&
                projectile.y + projectile.radius > target.y &&
                projectile.y - projectile.radius < target.y + target.height) {
                target.hit = true;
            }
        });

        if (targets.every(t => t.hit)) {
            projectile.isFlying = false;
            analysisModeButton.disabled = false;
            updateActualFlightStats();
            checkLevelCompletion();
        }

        if (projectile.x - projectile.radius < 0 || projectile.x + projectile.radius > canvas.width) {
            projectile.isFlying = false;
            analysisModeButton.disabled = false;
            updateActualFlightStats();
            checkLevelCompletion();
        }
    }

    function updateActualFlightStats() {
        if (projectile.path.length <= 1) return;
        const launchPoint = projectile.path[0];
        const finalPoint = projectile.path[projectile.path.length - 1];

        let actualMaxH = 0; // Max height above initial launch Y
        projectile.path.forEach(p => {
            if (launchPoint.y - p.y > actualMaxH) { // Canvas Y is inverted
                actualMaxH = launchPoint.y - p.y;
            }
        });
        actualMaxHeightDisplay.textContent = actualMaxH.toFixed(2);

        const actualR = finalPoint.x - launchPoint.x;
        actualRangeDisplay.textContent = actualR.toFixed(2);

        const actualT = finalPoint.t;
        actualTimeOfFlightDisplay.textContent = actualT.toFixed(2);
    }


    function checkLevelCompletion() {
        const allTargetsHit = targets.every(t => t.hit);
        const challengeCompletedOrNA = !currentChallenge || (currentChallenge.answered && currentChallenge.correct);

        if (allTargetsHit) {
            if (challengeCompletedOrNA) {
                levelMessageDisplay.textContent = `${levelSetups[currentLevelIndex].name} Cleared! Well Done!`;
                setTimeout(() => loadLevel(currentLevelIndex + 1), 2500);
            } else if (currentChallenge && !currentChallenge.answered) {
                 levelMessageDisplay.textContent = `Targets Hit! Now attempt the Level Challenge for ${levelSetups[currentLevelIndex].name}.`;
            } else if (currentChallenge && !currentChallenge.correct) {
                levelMessageDisplay.textContent = `Targets Hit! Challenge was incorrect. Review and try the challenge again or move to next level if allowed.`;
                // Optionally allow advancing or prompt to re-try challenge.
            }
        } else if (!projectile.isFlying && projectile.path.length > 1) {
             levelMessageDisplay.textContent = `Try Again for ${levelSetups[currentLevelIndex].name}. You hit ${targets.filter(t=>t.hit).length}/${targets.length} targets.`;
        }
    }

    let lastTime = 0;
    function gameLoop(timestamp) {
        if (!projectile.isFlying) {
            drawGame();
            return;
        }
        // Using fixed timeStep for physics updates, not deltaTime from requestAnimationFrame
        updateGameState();
        drawGame();
        requestAnimationFrame(gameLoop);
    }

    // Initial Setup
    loadLevel(0);
});
