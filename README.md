# VINTAGE RACER: AEGIS-X PROTOCOL

![Vintage Racer Hero](https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&q=80&w=1000)

**Vintage Racer** is a high-fidelity, dual-pilot local tactical racing simulation built using vanilla web technologies. Featuring an industrial, glassmorphic UI overlay, the simulation deploys dynamic physics, active particle systems, real-time environment cycling, and deep vehicle configuration controls under the Aegis-X protocol.

---

## 🚀 Key Features

*   **Aegis-X Industrial Design**: A premium dark-mode interface featuring glowing visual modules, technical geometric markers, glassmorphic HUD telemetry, and high-contrast styling variables.
*   **Dual-Pilot Local Co-op**: Play standalone or activate 2-player local split-lane operations with fully independent chassis configs, paint layers, and control schemes.
*   **Procedural Vector Rendering**: High-performance canvas rendering maps structural coordinates in real-time, delivering sharp geometric detail without raster scaling loss.
*   **Dynamic Thruster Arrays**: Multi-layered flame engine particle simulations with flickering hot points, heat spikes, and speed-adaptive motion trails.
*   **Day & Night Environment Cycles**: Ambient light shifts procedurally from bright noon through sunset dusk into midnight darkness, triggering active headlight paths and intensified neon rail glow.
*   **Dynamic Weather Protocols**: Procedural shift from clear skies to rainstorms (with velocity-matched raindrops) and dense atmospheric fog (with gradient depth fade).
*   **Dynamic Combat Events**:
    *   **Interceptor Pursuit**: Heavy armored police units deploy to chase down vehicles, flashing warning sirens and targeting the trailing player.
    *   **Narrows Protocol**: The track bounds shrink via a red warning laser boundary, compressing operations into middle lanes and destroying any vehicle that contacts the outer perimeter.

---

## 🏎️ Vehicle Fleet

Each chassis module features unique geometric vector coordinates, aerodynamic wing configurations, and dedicated exhaust setups.

```text
    ▲                     ▲                     ▲                     ▲                     ▲                     ▲
   / \                   /■\                   /█\                   /▲\                   /▼\                   /█\
  /   \                 / ■ \                 / █ \                 / ▲ \                 / ▼ \                 / █ \
 /_|_|_\               /═══■═══\             /█████\               /  ▲  \               /═════\               /█████\
[HOT ROD]            [STRIKER-X]          [HEAVY MUSCLE]       [PHANTOM SPECTER]       [CYBER APEX]         [AEROWING JET]
```

### 1. Hot Rod (Classic Customs)
*   **Design**: Exposed front double-wishbone suspension, chrome grille bars, classic cowl headlights, chopped low-profile windshield, and side-mounted chrome exhaust pipes with combustion flames.
*   **Thruster Profile**: Heavy single rear deep-burnout thruster with blue core plasma output.

### 2. Striker-X (PX) (Tactical Interceptor)
*   **Design**: Aggressive dual front winglet stabilizers, cockpit armor cage with safety stripes, central carbon-composite spine, and wing-mounted pod exhausts.
*   **Thruster Profile**: Heavy rear column focus with concentrated yellow-orange exhaust plumes.

### 3. Heavy Muscle (American Iron)
*   **Design**: High-displacement long hood, central air vents with secondary paint accents, bolted-on wide fender flares with steel rivet detailing, front splitters, and double racing stripes.
*   **Thruster Profile**: Dual high-output orange rear exhausts.

### 4. Phantom Specter ✦ (Stealth Fighter)
*   **Design**: Forward-swept aerodynamic nose horns, dual wing-mounted laser blaster cannons, metallic rear nozzle banks, lateral heat dissipation slits, and glowing energy conduit rails.
*   **Thruster Profile**: Triple plasma thrusters (two lateral wing jets + one central hyper-jet).

### 5. Cyber Apex (Formula Core)
*   **Design**: Open-wheel geometry with visible carbon suspension linkages, safety halo roll cage, multi-element front wing splitters, glowing air intakes, sidepods, and massive rear downforce diffusers.
*   **Thruster Profile**: Triple array wide-spread yellow plasma engines.

### 6. Aerowing Jet (Vanguard Aerospace) [NEW]
*   **Design**: Delta-wing aerospace configuration, dual forward-swept black pontoons with blue heat vents, yellow structural fins with warning decals, twin embedded side intake turbine fans, and green/red dashboard HUD projector paths.
*   **Thruster Profile**: Dual main engine orange exhausts coupled with twin cyan turbine exhaust trails.

---

## 🛠️ Color Core Customization

Pilots can independently configure primary and secondary hull paint layers with standard color swatches or advanced energy cores:

| Paint Core | Code / Swatch | Effect / Style |
| :--- | :--- | :--- |
| **Heat Gradient** | `grad-heat` | Procedural fire gradient shifting from deep red through orange to bright yellow. |
| **Cool Gradient** | `grad-cool` | Cryo energy core shifting from deep indigo through sky blue to electric cyan. |
| **Nebula Gradient** | `grad-nebula` | Cosmic solar wind style blending neon yellow, solar orange, and deep space violet. |
| **Hazard Gradient** | `grad-hazard` | Warning alert system mapping industrial dark teal to high-contrast warning red. |
| **Chassis Color Cores** | Multiple | 17+ tactical paint chips including Sand Beige, Tactical Lime, Rust Orange, and Sage Green. |

---

## 🎯 Obstacles & Repair Cores

Avoid path obstructions and collect repair cores to sustain system structural integrity:

*   **Oil Slicks**: Causes traction loss, forcing vehicles to slide laterally and rendering directional steering inputs temporarily unresponsive.
*   **Traffic Cones**: Standard construction barriers. Impact results in immediate structural damage (life loss).
*   **High-Energy Lasers**: Multi-lane spanning plasma beams emitted from heavy concrete emitter towers. Requires immediate evasive lane changes.
*   **Repair Cores**: Floating cyan diamond power-ups containing nanite repair modules. Collecting a core restores 1 life point (capped at 5).

---

## 🎮 Tactical Controls

All configuration and launch commands are fully operational on keyboard systems.

### Player 1 (MODULE_P1)
*   **Accelerate / Throttle**: `W`
*   **Brake / Reverse**: `S`
*   **Steer Port (Left)**: `A`
*   **Steer Starboard (Right)**: `D`

### Player 2 (MODULE_P2)
*   **Accelerate / Throttle**: `↑` (Arrow Up)
*   **Brake / Reverse**: `↓` (Arrow Down)
*   **Steer Port (Left)**: `←` (Arrow Left)
*   **Steer Starboard (Right)**: `→` (Arrow Right)

### Operational Command
*   **Pause Mission**: `ESC` or On-Screen Interface Pause Button.
*   **Terminal Navigation**: Mouse interface to configure color arrays and chassis models.

---

## 📁 System Architecture

```text
├── index.html     # Main Terminal UI Overlay, custom CSS grid layouts & start screen panels
├── game.js        # Core Engine, vector asset definitions, collision arrays & weather loops
├── style.css      # Aegis-X design system variables, glassmorphic plates & UI animations
└── README.md      # Protocol Intelligence Documentation
```

---

## ⚙️ Execution & Boot Instructions

No installation, build steps, or server dependencies are required to launch.

1. Locate `index.html` in the file explorer.
2. Launch `index.html` in a modern WebGL-compliant web browser.
3. Select your chassis and color cores under `MODULE_P1` or `MODULE_P2`.
4. Click **LAUNCH SYNC** to initiate.

---

*// STATUS: OPERATIONAL // REVISION 3.5.3 // MODULE: AEGIS-X //*
