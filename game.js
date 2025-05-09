document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Controls & Displays
    const angleSlider = document.getElementById('angle');
    const powerSlider = document.getElementById('power');
    const angleValueDisplay = document.getElementById('angleValue');
    const powerValueDisplay = document.getElementById('powerValue');
    const launchButton = document.getElementById('launchButton');
    const resetButton = document.getElementById('resetButton');
    const maxHeightDisplay = document.getElementById('maxHeightDisplay');
    const rangeDisplay = document.getElementById('rangeDisplay');
    const timeOfFlightDisplay = document.getElementById('timeOfFlightDisplay');
    const levelMessageDisplay = document.getElementById('levelMessage');

    // Game Constants
    const G = 9.81; // Acceleration due to gravity (m/s^2)
    const timeStep = 0.05; // Simulation time step for animation smoothness
    const groundLevel = canvas.height - 40; // Y-coordinate of the ground

    // Slingshot Properties
    const slingshotX = 80;
    const slingshotY = groundLevel - 30; // Position of the "release point" of the slingshot
    const slingshotVisualBaseY = groundLevel;
    const slingshotVisualHeight = 50;

    // Projectile State
    let projectile = {
        x: slingshotX,
        y: slingshotY,
        radius: 8,
        color: '#FF4500', // Orangey-Red
        vx: 0,
        vy: 0,
        isFlying: false,
        path: [] // To trace the trajectory
    };

    // Target Properties & Levels
    let currentLevelIndex = 0;
    let targets = [];
    const levelSetups = [
        {
            message: "Level 1: Hit the single target!",
            targets: [{ x: 500, y: groundLevel - 20, width: 40, height: 40, color: '#2E8B57', hit: false }]
        },
        {
            message: "Level 2: Two targets! One is higher.",
            targets: [
                { x: 400, y: groundLevel - 20, width: 30, height: 30, color: '#2E8B57', hit: false },
                { x: 600, y: groundLevel - 80, width: 50, height: 50, color: '#3CB371', hit: false }
            ]
        },
        {
            message: "Level 3: A distant challenge!",
            targets: [{ x: 700, y: groundLevel - 30, width: 60, height: 60, color: '#2E8B57', hit: false }]
        },
        {
            message: "Level 4: Thread the needle (concept - not implemented, would need obstacles).",
            targets: [{ x: 550, y: groundLevel - 100, width: 40, height: 40, color: '#2E8B57', hit: false }]
        }
    ];

    function loadLevel(levelIdx) {
        currentLevelIndex = levelIdx;
        if (currentLevelIndex >= levelSetups.length) {
            levelMessageDisplay.textContent = "All Levels Completed! Congratulations!";
            launchButton.disabled = true;
            targets = []; // Clear targets
            resetProjectileState();
            drawGame();
            return;
        }
        const level = levelSetups[currentLevelIndex];
        targets = JSON.parse(JSON.stringify(level.targets)); // Deep copy to allow modification (hit status)
        levelMessageDisplay.textContent = level.message;
        launchButton.disabled = false;
        resetProjectileState();
        predictTrajectory(); // Show initial prediction
        drawGame();
    }

    function resetProjectileState() {
        projectile.isFlying = false;
        projectile.x = slingshotX;
        projectile.y = slingshotY;
        projectile.vx = 0;
        projectile.vy = 0;
        projectile.path = [];
    }

    // Event Listeners for Controls
    angleSlider.addEventListener('input', () => {
        angleValueDisplay.textContent = `${angleSlider.value}°`;
        if (!projectile.isFlying) predictTrajectory();
    });
    powerSlider.addEventListener('input', () => {
        powerValueDisplay.textContent = `${powerSlider.value} m/s`;
        if (!projectile.isFlying) predictTrajectory();
    });

    launchButton.addEventListener('click', () => {
        if (projectile.isFlying) return;

        const angle = parseFloat(angleSlider.value) * Math.PI / 180; // Convert to radians
        const initialSpeed = parseFloat(powerSlider.value);

        projectile.vx = initialSpeed * Math.cos(angle);
        projectile.vy = -initialSpeed * Math.sin(angle); // Negative for upward Y in canvas
        projectile.isFlying = true;
        projectile.x = slingshotX; // Reset position just before launch
        projectile.y = slingshotY;
        projectile.path = [{ x: projectile.x, y: projectile.y }]; // Start path tracking
        gameLoop();
    });

    resetButton.addEventListener('click', () => {
        loadLevel(currentLevelIndex);
    });

    function predictTrajectory() {
        const angle = parseFloat(angleSlider.value) * Math.PI / 180;
        const v0 = parseFloat(powerSlider.value);
        const v0x = v0 * Math.cos(angle);
        const v0y = v0 * Math.sin(angle); // Physics y (positive up)

        // Time to reach max height (where vy_physics = 0): t_peak = v0y / G
        const t_peak = v0y / G;
        // Max height above launch point: H = v0y * t_peak - 0.5 * G * t_peak^2 = (v0y^2) / (2*G)
        const h_max_above_launch = (v0y * v0y) / (2 * G);
        maxHeightDisplay.textContent = h_max_above_launch.toFixed(2);

        // Time of flight to return to launch height: T_flat = 2 * v0y / G
        // Range on flat ground: R_flat = v0x * T_flat
        // For flight to groundLevel (y_final_physics = launchY_physics - groundY_physics difference)
        // y_launch_physics = 0 (relative launch point)
        // y_final_physics = slingshotY - groundLevel (this will be negative as ground is below slingshotY)
        // y_final = v0y*t - 0.5*G*t^2
        // 0.5*G*t^2 - v0y*t + (slingshotY - groundLevel) = 0
        let a = 0.5 * G;
        let b = -v0y;
        let c = slingshotY - groundLevel; // y-displacement to ground; canvas y is inverted, physics y normal

        let discriminant = b * b - 4 * a * c;
        let t_flight = 0;
        if (discriminant >= 0) {
            // t = (-b + sqrt(discriminant)) / (2a)  (we take the positive, sensible root)
            t_flight = (-b + Math.sqrt(discriminant)) / (2 * a);
        } else {
            // If it never reaches groundlevel (e.g. fired straight up and lands on a platform above slingshot)
            // This simplified prediction assumes it will go towards groundlevel.
            // Fallback for extreme cases, or if launched downwards (not possible with UI)
            t_flight = (2 * v0y) / G; // Time to return to launch height as an estimate
        }

        const range = v0x * t_flight;
        timeOfFlightDisplay.textContent = t_flight > 0 ? t_flight.toFixed(2) : "0.00";
        rangeDisplay.textContent = range > 0 ? range.toFixed(2) : "0.00";

        drawGame(); // Redraw to show predictive line
    }


    function drawGame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

        // Draw Ground
        ctx.fillStyle = '#228B22'; // ForestGreen
        ctx.fillRect(0, groundLevel, canvas.width, canvas.height - groundLevel);

        // Draw Slingshot Visual (simple)
        ctx.fillStyle = '#8B4513'; // SaddleBrown
        ctx.fillRect(slingshotX - 10, slingshotVisualBaseY - slingshotVisualHeight, 20, slingshotVisualHeight);
        // A small platform for the projectile to sit on
        ctx.fillRect(slingshotX - 15, slingshotY - 5, 30, 10);


        // Draw Targets
        targets.forEach(target => {
            ctx.fillStyle = target.hit ? '#A9A9A9' : target.color; // Grey out if hit
            ctx.fillRect(target.x, target.y, target.width, target.height);
        });

        // Draw Projectile
        if (projectile.isFlying || !projectile.isFlying) { // Always draw it, controlled by its x,y
            ctx.beginPath();
            ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
            ctx.fillStyle = projectile.color;
            ctx.fill();
        }

        // Draw Projectile Path if flying
        if (projectile.isFlying && projectile.path.length > 1) {
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(projectile.path[0].x, projectile.path[0].y);
            for (let i = 1; i < projectile.path.length; i++) {
                ctx.lineTo(projectile.path[i].x, projectile.path[i].y);
            }
            ctx.stroke();
        }

        // Draw Predictive Trajectory Line if NOT flying
        if (!projectile.isFlying) {
            const angle = parseFloat(angleSlider.value) * Math.PI / 180;
            const initialSpeed = parseFloat(powerSlider.value);
            let simX = slingshotX;
            let simY = slingshotY;
            let simVx = initialSpeed * Math.cos(angle);
            let simVy = -initialSpeed * Math.sin(angle); // Canvas Y is inverted

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; // White dotted line
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]); // Dashed line
            ctx.beginPath();
            ctx.moveTo(simX, simY);

            for (let t = 0; t < 10; t += 0.1) { // Simulate for a few seconds
                simVy += G * 0.1; // Apply gravity over the small time segment for preview
                simX += simVx * 0.1;
                simY += simVy * 0.1;
                if (simY + projectile.radius > groundLevel || simX > canvas.width || simX < 0) break;
                ctx.lineTo(simX, simY);
            }
            ctx.stroke();
            ctx.setLineDash([]); // Reset line dash
        }
    }

    function updateGameState() {
        if (!projectile.isFlying) return;

        // Apply gravity
        projectile.vy += G * timeStep;

        // Update position
        projectile.x += projectile.vx * timeStep;
        projectile.y += projectile.vy * timeStep;
        projectile.path.push({ x: projectile.x, y: projectile.y });


        // Collision with ground
        if (projectile.y + projectile.radius > groundLevel) {
            projectile.y = groundLevel - projectile.radius;
            projectile.isFlying = false;
            updateActualFlightStats();
            checkLevelCompletion();
        }

        // Collision with targets
        targets.forEach(target => {
            if (!target.hit &&
                projectile.x + projectile.radius > target.x &&
                projectile.x - projectile.radius < target.x + target.width &&
                projectile.y + projectile.radius > target.y &&
                projectile.y - projectile.radius < target.y + target.height) {
                target.hit = true;
                // Optional: Stop projectile on hit or make it bounce slightly
                // projectile.isFlying = false; // For now, let it pass through but mark target
                // For a more "Angry Birds" feel, the projectile would stop or cause destruction.
                // Here, we focus on just hitting.
            }
        });

        // If all targets are hit, end flight
        if (targets.every(t => t.hit)) {
            projectile.isFlying = false;
            updateActualFlightStats();
            checkLevelCompletion();
        }

        // Boundary check (sides of canvas)
        if (projectile.x - projectile.radius < 0 || projectile.x + projectile.radius > canvas.width) {
            projectile.isFlying = false;
            updateActualFlightStats();
            checkLevelCompletion();
        }
    }

    function updateActualFlightStats() {
        // Calculate actual stats based on projectile.path
        const launchPoint = projectile.path[0];
        const finalPoint = projectile.path[projectile.path.length - 1];

        let actualMaxHeight = 0; // Height above launch point
        projectile.path.forEach(p => {
            if (launchPoint.y - p.y > actualMaxHeight) {
                actualMaxHeight = launchPoint.y - p.y;
            }
        });
        maxHeightDisplay.textContent = actualMaxHeight.toFixed(2);

        const actualRange = finalPoint.x - launchPoint.x;
        rangeDisplay.textContent = actualRange.toFixed(2);

        const actualTimeOfFlight = (projectile.path.length -1) * timeStep;
        timeOfFlightDisplay.textContent = actualTimeOfFlight.toFixed(2);
    }

    function checkLevelCompletion() {
        if (targets.every(t => t.hit)) {
            levelMessageDisplay.textContent = `Level ${currentLevelIndex + 1} Cleared! Well Done!`;
             setTimeout(() => {
                loadLevel(currentLevelIndex + 1);
            }, 2000); // Auto-advance to next level
        } else if (!projectile.isFlying && projectile.path.length > 1) { // Flight ended, not all hit
             levelMessageDisplay.textContent = `Try Again for Level ${currentLevelIndex + 1}. You hit ${targets.filter(t=>t.hit).length}/${targets.length} targets.`;
        }
    }


    let lastTime = 0;
    function gameLoop(currentTime) {
        if (!projectile.isFlying) {
            drawGame(); // Ensure a final draw if flight just ended
            return;
        }

        const deltaTime = (currentTime - lastTime) / 1000 || timeStep; // time in seconds, fallback for first frame
        lastTime = currentTime;

        // It's often simpler to use a fixed timeStep for physics updates
        // and let requestAnimationFrame handle rendering smoothly.
        // For this example, we'll tie update to frame rate but use our fixed timeStep in calculations.
        updateGameState(); // Uses fixed timeStep internally
        drawGame();

        requestAnimationFrame(gameLoop);
    }

    // Initial Setup
    loadLevel(0);
});
