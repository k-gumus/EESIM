// Deney içeriğinin İngilizcesi: seviye ve konu adları, tüm katalog başlıkları ve
// "Başlangıç yolu"ndaki 8 deneyin föyleri. Föyü çevrilmemiş deneyler Türkçe gösterilir.
import { getLang, t } from './index';
import type { Template, LabStep } from '../templates/lib';
import { topicById } from '../templates/topics';

const LEVEL_EN: Record<string, string> = { Isınma: 'Warm-up', Temel: 'Basic', Orta: 'Intermediate', İleri: 'Advanced' };
export const tLevel = (l: string) => (getLang() === 'en' ? (LEVEL_EN[l] ?? l) : l);

const TOPIC_EN: Record<string, [title: string, desc: string]> = {
  dc: ['DC Circuit Analysis', 'Ohm, Kirchhoff, Thevenin/Norton, superposition, bridges, dependent sources'],
  transient: ['Transients', 'Time response of RC, RL and RLC circuits, time constant, damping'],
  ac: ['AC Circuits and Resonance', 'Phasors, impedance, phase difference, resonance, transformers'],
  filters: ['Filters', 'Passive and active low-pass, high-pass and band-pass filters'],
  diode: ['Diode Circuits', 'Rectifiers, clipper, clamper, voltage multiplier, Zener, LED'],
  bjt: ['BJT Transistors', 'Biasing, switching, amplifiers, current mirror, multivibrator'],
  mosfet: ['MOSFET and CMOS', 'MOSFET switch, common-source amplifier, CMOS inverter'],
  opamp: ['Operational Amplifiers', 'Inverting/non-inverting, summing, difference, integrator/differentiator, comparator'],
  osc: ['Oscillators and Timers', '555, Wien bridge, relaxation oscillator, astable multivibrator'],
  power: ['Power Supplies and Power Electronics', 'Linear regulator, buck/boost converter, PWM'],
  digital: ['Digital Electronics', 'Logic gates, pull-up/pull-down, flip-flops, counters'],
  measure: ['Measurement, Sensors and Interfacing', 'Meters, Wheatstone bridge, LDR/NTC sensor circuits'],
};
export const topicTitle = (id: string) => (getLang() === 'en' ? TOPIC_EN[id]?.[0] : undefined) ?? topicById(id)?.title ?? id;
export const topicDesc = (id: string) => (getLang() === 'en' ? TOPIC_EN[id]?.[1] : undefined) ?? topicById(id)?.desc ?? '';

/** Katalogdaki her deneyin İngilizce başlığı ve alt başlığı */
const ENTRY_EN: Record<string, [title: string, subtitle: string]> = {
  'led-ohm': ['LED and Ohm’s Law', 'Your first circuit: switch, current-limiting resistor and ammeter'],
  'voltage-divider': ['Voltage Divider and Loading', 'Divide a voltage with two resistors; why does it drop under load?'],
  'kvl-kcl': ['Kirchhoff’s Laws (KVL and KCL)', 'Current and voltage distribution in a series–parallel circuit'],
  thevenin: ['Thevenin Equivalent and Maximum Power Transfer', 'Open-circuit voltage, equivalent resistance and R_L = R_TH'],
  superposition: ['Superposition Principle', 'Find the effect of each source separately, then add'],
  'dependent-source': ['Dependent Source: Amplifier Model', 'Input resistance, voltage-controlled source and output resistance'],
  'rc-charge': ['RC Charge–Discharge and Time Constant', 'A capacitor charging and discharging with a square wave, τ = RC'],
  'rlc-step': ['Series RLC Step Response and Damping', 'See under-, critically and over-damped responses'],
  'rc-diff-int': ['RC Differentiator and Integrator', 'Same square wave: spikes with small τ, triangle with large τ'],
  'rc-phase': ['Amplitude and Phase in an RC Circuit', 'At the cutoff frequency: amplitude 70.7%, phase −45°'],
  'series-resonance': ['Series RLC Resonance', 'Current peaks when X_L = X_C; quality factor Q'],
  'transformer-ratio': ['Transformer Turns Ratio', 'Low voltage from the mains: voltage and current ratios'],
  'rc-lowpass': ['RC Low-Pass Filter', 'f_c = 1/(2πRC); −20 dB/decade above cutoff'],
  'rc-highpass': ['RC High-Pass Filter', 'Block DC and low frequencies, leading phase'],
  'sallen-key': ['Active Low-Pass Filter (Sallen–Key)', 'Second order, −40 dB/decade, op-amp buffered'],
  'half-wave': ['Half-Wave Rectifier', 'One diode, a load resistor and a filter capacitor'],
  'full-wave': ['Full-Wave Bridge Rectifier', 'Mains (220 V / 50 Hz) → 10:1 transformer → 4-diode bridge'],
  clipper: ['Double-Sided Clipper', 'Clip a signal at +3.7 V / −2.7 V with two biased diodes'],
  clamper: ['Clamper', 'Add a DC level to a signal with a capacitor and a diode'],
  zener: ['Zener Voltage Regulator', 'Output ≈ 5.1 V even as input and load change'],
  'center-tap': ['Centre-Tapped Full-Wave Rectifier', 'Two diodes + centre-tapped transformer; compare with the bridge'],
  'voltage-doubler': ['Voltage Doubler (Villard–Greinacher)', 'Clamper + peak detector = 2·V_p DC'],
  'diode-iv': ['Diode I–V Characteristic (XY Mode)', 'Plot the Shockley curve on the scope; silicon vs Schottky'],
  'bjt-bias': ['BJT Voltage-Divider Bias', 'Q point (I_C, V_CE) of a common-emitter NPN'],
  'bjt-switch': ['Switching an LED with a Transistor', 'Drive a big load with a small base current; saturation condition'],
  'ce-amp': ['Common-Emitter Amplifier', 'Small-signal gain and the effect of the emitter bypass capacitor'],
  'current-mirror': ['BJT Current Mirror', 'Copy a reference current; a load-independent current source'],
  'mosfet-pwm': ['PWM Brightness Control with a MOSFET', 'Power MOSFET as a switch; average power via duty cycle'],
  'cmos-inverter': ['CMOS Inverter and Transfer Curve', 'NMOS + PMOS = the basis of digital logic'],
  'opamp-inverting': ['Inverting Amplifier', 'A_v = −R2/R1; virtual ground and saturation'],
  'opamp-noninverting': ['Non-Inverting Amplifier and Voltage Follower', 'A_v = 1 + R2/R1; isolate the load with a buffer'],
  'opamp-summing': ['Summing Amplifier (Audio Mixer)', 'V_out = −R_F·(V1/R1 + V2/R2)'],
  'opamp-integrator': ['Op-amp Integrator', 'Triangle wave from a square wave; the role of R_F'],
  'opamp-schmitt': ['Comparator and Schmitt Trigger', 'Hysteresis with positive feedback: noise-immune thresholds'],
  '555-astable': ['555 Astable: LED Flasher', 'A square-wave oscillator from two resistors and a capacitor'],
  '555-monostable': ['555 Monostable: One-Shot Timer', 'Press the button → LED stays on for T = 1.1·R·C'],
  'bjt-astable': ['Astable Multivibrator (Flashing LEDs)', 'Two transistors, two capacitors: alternating LEDs'],
  'opamp-relaxation': ['Op-amp Relaxation Oscillator', 'Schmitt trigger + RC = square-wave generator'],
  'linear-psu': ['Linear Power Supply (5 V)', 'Transformer → bridge → filter → 7805: inside a wall adapter'],
  buck: ['Buck (Step-Down) DC–DC Converter', '12 V → ~6 V, switching and highly efficient'],
  boost: ['Boost (Step-Up) DC–DC Converter', '5 V → ~10 V: raising voltage with an inductor'],
  'logic-gates': ['Logic Gates and Truth Tables', 'AND, OR, XOR, NAND — try them with switches'],
  'pullup-pulldown': ['Button, Pull-Down and Pull-Up Resistors', 'Why is a floating input dangerous? Fix it with 10 kΩ'],
  'half-adder': ['Half Adder', 'Add two bits with XOR + AND'],
  'sr-latch': ['SR Latch (1-Bit Memory with NOR)', 'Feedback = memory'],
  'ripple-counter': ['2-Bit Counter with D Flip-Flops', 'Frequency divider and ripple counter'],
  'wheatstone-ntc': ['Temperature Measurement with a Wheatstone Bridge', 'Balanced bridge, NTC and measuring small resistance changes'],
  'ldr-nightlight': ['Automatic Night Light with an LDR', 'Light sensor + comparator + adjustable threshold'],
  lissajous: ['Oscilloscope: XY Mode and Lissajous Figures', 'Read phase and frequency ratio from the shape'],
  norton: ['Norton Equivalent and Source Transformation', 'Short-circuit current + equivalent resistance = same behaviour'],
  'meter-loading': ['Meter Loading Effect', 'Why does a voltmeter’s internal resistance change the voltage you measure?'],
  'rl-transient': ['Current Rise in an RL Circuit', 'τ = L/R: an inductor resists sudden changes in current'],
  'inductive-kick': ['Inductive Kick and the Flyback Diode', 'The voltage spike when a relay coil is switched off'],
  'parallel-resonance': ['Parallel Resonance (Tank Circuit)', 'At resonance the impedance of L ∥ C is maximum'],
  'power-factor': ['Power Factor and Its Correction', 'Raise cos φ by adding a capacitor to an inductive load'],
  'band-pass': ['RLC Band-Pass Filter', 'Centre frequency, bandwidth and quality factor'],
  'active-hpf': ['Active High-Pass Filter', 'RC filter + non-inverting amplifier: gain and an unloaded output'],
  'peak-detector': ['Peak Detector', 'Diode + capacitor: hold the peak value of a signal'],
  'reverse-polarity': ['Reverse Polarity Protection', 'Don’t let the circuit burn if the battery is inserted backwards'],
  'led-series-parallel': ['LEDs in Series and Parallel', 'Why does each LED need its own resistor?'],
  'emitter-follower': ['Emitter Follower (Common Collector)', 'Voltage gain ≈ 1, but drives the load with ease'],
  darlington: ['Darlington Pair', 'β₁·β₂: drive amperes with microamperes'],
  'diff-pair': ['Differential Pair', 'The input stage of an op-amp: amplify the difference, reject the common signal'],
  'push-pull': ['Class B Push-Pull Output Stage', 'NPN pushes, PNP pulls — and crossover distortion'],
  'id-vgs': ['MOSFET Transfer Characteristic (I_D–V_GS)', 'Threshold voltage and the square law in scope XY mode'],
  'load-switch': ['P-MOSFET Load Switch (High Side)', 'Switch the positive side of a 12 V load with 5 V logic'],
  'h-bridge': ['DC Motor Direction Control with an H-Bridge', 'Four switches, two directions, and a brake'],
  'zener-follower': ['Zener + Emitter Follower Regulator', 'A discrete linear regulator: the ancestor of the 7805'],
  'current-limit': ['Transistor Current Limiting', 'A short-circuit-proof power supply'],
  'difference-amp': ['Difference Amplifier', 'Amplify the difference of two voltages, ignore the common part'],
  differentiator: ['Op-amp Differentiator', 'The derivative of a triangle wave is a square wave'],
  'precision-rectifier': ['Precision Rectifier (Super Diode)', 'Rectify signals smaller than 0.6 V too'],
  'comparator-window': ['Window Comparator', 'Is the voltage between 2 and 3 V?'],
  wien: ['Wien Bridge Oscillator', 'Generating a pure sine wave with stable amplitude'],
  'rc-phase-shift': ['RC Phase-Shift Oscillator', 'Three RC stages give 180°, the inverting amplifier 180° more'],
  '555-pwm': ['PWM Generator with a 555', 'Fixed frequency, duty cycle set by a potentiometer'],
  'full-adder': ['Full Adder', 'Two half adders + OR: add with carry'],
  mux: ['Multiplexer (2:1 MUX)', 'Route one of two inputs to the output with a select line'],
  'shift-register': ['Shift Register', 'Serial–parallel conversion: bits shift right with the clock'],
  'dac-r2r': ['R-2R Ladder DAC', 'Digital to analogue with just two resistor values'],
  'meter-internal': ['Ammeter Internal Resistance', 'A series meter changes the current in low-resistance circuits'],
  'nodal-mesh': ['Nodal and Mesh Analysis', 'Solve a multi-source circuit systematically, verify by simulation'],
  'wye-delta': ['Wye–Delta (Y–Δ) Transformation', 'Equivalent resistance in bridge circuits'],
  'rlc-parallel': ['Parallel RLC Step Response', 'Over-, critically and under-damped cases'],
  'three-phase': ['Three-Phase Systems: Wye and Delta', 'Phase and line voltages, the √3 relation'],
  'max-power-ac': ['Maximum Power Transfer in AC', 'Conjugate impedance matching'],
  phasor: ['Solving AC Circuits with Phasors', 'Magnitude–phase representation of voltage and current'],
  notch: ['Notch Filter — Twin-T', 'Suppress 50 Hz mains hum'],
  bode: ['Drawing a Bode Plot', 'Magnitude/phase curves from a frequency sweep'],
  'rc-ladder': ['Multi-Stage RC Filter', 'Number of stages and slope (dB/decade)'],
  'schottky-vs-si': ['Schottky vs Silicon Diode', 'Forward drop, efficiency and reverse current'],
  'diode-logic': ['AND/OR with Diode Logic (DL)', 'Gates without transistors'],
  'ic-vce': ['BJT Output Characteristic (I_C–V_CE)', 'Active, saturation and cutoff regions'],
  'relay-driver': ['Driving a Relay with a Transistor', 'Control a 220 V load from a microcontroller'],
  'common-source': ['Common-Source MOSFET Amplifier', 'g_m and gain'],
  'cmos-nand': ['CMOS NAND Gate', 'Logic at the transistor level'],
  'instrumentation-amp': ['Instrumentation Amplifier', 'High CMRR with three op-amps'],
  transimpedance: ['Transimpedance Amplifier', 'Convert photodiode current to voltage'],
  colpitts: ['Colpitts LC Oscillator', 'A sine wave at radio frequencies'],
  vco: ['Voltage-Controlled Oscillator (VCO)', 'Set the frequency with a voltage'],
  'buck-boost': ['Buck-Boost Converter', 'Inverted polarity, step down or up'],
  'battery-charger': ['Current-Limited Battery Charger', 'Constant current / constant voltage'],
  'solar-mppt': ['Solar Panel and MPPT', 'Tracking the maximum power point'],
  lm317: ['LM317 Adjustable Regulator', 'Set the output voltage with two resistors'],
  debounce: ['Button Debouncing', 'A clean digital signal with RC + Schmitt'],
  'jk-counter': ['Synchronous Counter with JK Flip-Flops', 'From state diagram to circuit'],
  'seven-seg': ['Driving a 7-Segment Display', 'Decoding BCD to 7 segments'],
  'strain-gauge': ['Strain Gauge Bridge', 'Measuring weight and force'],
  thermocouple: ['Thermocouple Signal Conditioning', 'From µV levels to a readable signal'],
  'adc-basics': ['ADC Basics: Sampling and Quantisation', 'Resolution, Nyquist and aliasing'],
};

export const entryTitle = (e: { id: string; title: string }) => (getLang() === 'en' ? ENTRY_EN[e.id]?.[0] : undefined) ?? e.title;
export const entrySubtitle = (e: { id: string; subtitle: string }) => (getLang() === 'en' ? ENTRY_EN[e.id]?.[1] : undefined) ?? e.subtitle;

type StepEN = Partial<Pick<LabStep, 'title' | 'text' | 'hint' | 'success'>> & { q?: string; o?: string[]; e?: string; label?: string };
interface SheetEN {
  theory: string;
  steps: Record<string, StepEN>;
}

/** İngilizceye çevrilmiş deney föyleri (Başlangıç yolu) */
const SHEET_EN: Record<string, SheetEN> = {
  'led-ohm': {
    theory:
      'An LED is a diode: in the forward direction (anode → cathode) it shows an almost constant voltage drop (red ≈ 1.8 V). What limits the current is the series resistor: I = (V_source − V_LED) / R. An ammeter is connected in series and has ≈ 0 Ω internal resistance; a voltmeter is connected in parallel and has ≈ ∞ internal resistance.',
    steps: {
      s1: { title: 'Start the simulation', text: 'Press **▶ Start** at the top. Switch S1 is open right now, so no current flows in the circuit.' },
      s2: {
        title: 'Close the switch',
        text: 'Double-click switch **S1** (or select it and press **Space**). The dots on the wires show the direction and size of the current; the LED should light up!',
        success: 'Light! 💡 Current leaves the (+) terminal and returns to ground through the LED.',
      },
      s3: {
        title: 'Read the ammeter',
        text: 'DMM1 is on the current range (**A ⎓**) and connected **in series**. You should see about 15 mA.',
        q: 'The current is ≈ 15.2 mA. Roughly what is the voltage across the LED? (V₁ = 9 V, R₁ = 470 Ω)',
        o: ['≈ 1.85 V', '≈ 7.1 V', '≈ 9 V', '≈ 0.7 V'],
        e: 'KVL: V_LED = 9 V − I·R = 9 − 0.0152·470 ≈ 1.85 V. Red LEDs typically have a forward voltage of 1.8–2 V.',
      },
      s4: {
        title: 'Reduce the resistor',
        text: 'Select **R1** and set it to **220 Ω**. The LED gets brighter… but careful!',
        success: 'The current rose to ~32 mA. The LED’s maximum is 30 mA — in real life this shortens its life or burns it out!',
      },
      s5: {
        title: 'Save the LED',
        text: 'Calculate the resistor that brings the LED current down to ~10 mA and enter it in R1. (Hint: R = (9 − 1.85) / 0.01)',
        hint: 'R ≈ 715 Ω → standard value 680 Ω or 750 Ω',
        success: 'Great engineering! Picking the nearest value from the standard E12 series is exactly what real designs do.',
      },
    },
  },
  'voltage-divider': {
    theory:
      'In two series resistors the current is the same and the voltage divides in proportion to the resistances: VOUT = VIN·R2/(R1+R2). When a load is connected to the output, R2‖RL replaces R2 and the output drops. The Thevenin equivalent of the divider: V_TH = 6 V, R_TH = R1‖R2 = 5 kΩ.',
    steps: {
      run: { title: 'Start', text: 'Press **▶ Start**. DMM1 measures the voltage across R2 (VOUT).' },
      q1: {
        title: 'Unloaded output',
        text: 'With S1 open no load is connected.',
        q: 'What is VOUT? (V1 = 12 V, R1 = R2 = 10 kΩ)',
        o: ['6 V', '12 V', '4 V', '3 V'],
        e: 'VOUT = V1·R2/(R1+R2) = 12·10k/20k = 6 V.',
      },
      s1: { title: 'Connect the load', text: 'Close **S1** (double-click). The 10 kΩ RL is now in parallel with R2.' },
      q2: {
        title: 'Loaded output',
        text: 'Look at the new reading of DMM1.',
        q: 'Roughly what is VOUT with the load connected?',
        o: ['4 V', '6 V', '5 V', '2 V'],
        e: 'Since R2‖RL = 5 kΩ, VOUT = 12·5k/15k = 4 V. The divider’s output resistance (R1‖R2 = 5 kΩ) forms a divider with the load.',
      },
      s2: {
        title: 'Rule: RL ≫ R',
        text: 'Set **RL** to **100 kΩ**. How close is the output to 6 V now?',
        success: 'VOUT ≈ 5.7 V. The load resistance should be at least ~10 times the divider resistors, otherwise the reference voltage is spoiled.',
      },
    },
  },
  'rc-charge': {
    theory:
      'When a step voltage is applied to an RC circuit the capacitor charges exponentially: v_C(t) = V·(1 − e^(−t/RC)). After τ = RC it reaches 63.2% of the final value, after 5τ 99.3%. Discharge: v_C(t) = V·e^(−t/RC).',
    steps: {
      run: { title: 'Start', text: '**▶ Start**. CH1 shows the square-wave input, CH2 the capacitor voltage.' },
      q1: { title: 'Time constant', text: 'R = 1 kΩ, C = 1 µF', q: 'What is τ = RC?', o: ['1 ms', '1 µs', '10 ms', '0.1 ms'], e: 'τ = 1000 Ω · 1 µF = 1 ms. On the scope 1 division = 1 ms.' },
      q2: {
        title: 'At t = τ',
        text: 'Charging curve v(t) = 5·(1 − e^(−t/τ))',
        q: 'What is VC one τ after charging starts?',
        o: ['≈ 3.16 V', '≈ 2.5 V', '≈ 5 V', '≈ 1.84 V'],
        e: '1 − e^(−1) ≈ 0.632 → 0.632·5 ≈ 3.16 V. After 5τ it reaches 99%.',
      },
      s1: {
        title: 'Increase C',
        text: 'Set **C1** to **4.7 µF**.',
        success: 'τ = 4.7 ms; half a period (5 ms) ≈ 1τ → the capacitor can no longer charge fully and the output looks like a triangle.',
      },
    },
  },
  'half-wave': {
    theory:
      'In a half-wave rectifier the diode conducts only on positive half-cycles, when the anode is ~0.7 V above the cathode. The output peak is V_p,out = V_p − V_D and the unfiltered DC value is V_p/π. With a capacitor in parallel with the output, it charges to the peak and discharges through RL while the diode is off; ripple V_r ≈ V_p/(f·R·C).',
    steps: {
      s1: { title: 'Start', text: 'Press **▶ Start** and watch the oscilloscope below. CH1 (yellow) shows the input, CH2 (blue) the output.' },
      s2: {
        title: 'Interpret the waveform',
        text: 'The output appears only on positive half-cycles; on the negative half-cycle the diode is reverse biased and no current flows.',
        q: 'Why is the output peak (~9.2 V) smaller than the input peak (10 V)?',
        o: ['The diode’s forward voltage drop (≈0.7 V)', 'Voltage division between RL and the source', 'The scope probe loading the circuit', 'The source frequency is too high'],
        e: 'A conducting silicon diode drops about 0.6–0.8 V: V_out,peak ≈ V_peak − V_D.',
      },
      s3: {
        title: 'Average (DC) value',
        text: 'Look at the CH2 **Avg** reading in the oscilloscope panel.',
        q: 'Roughly what is the DC (average) output of an unfiltered half-wave rectifier?',
        o: ['V_peak / π ≈ 2.9 V', 'V_peak / √2 ≈ 6.5 V', 'V_peak ≈ 9.2 V', '0 V'],
        e: 'The average of a half sine is V_p/π. 9.2 V / π ≈ 2.9 V.',
      },
      s4: {
        title: 'Switch in the filter',
        text: 'Close **S1** to connect the 10 µF capacitor to the output. The output turns into “rippled DC”.',
        success: 'The capacitor charges at the peak and feeds the load while the diode is off — that’s a filter!',
      },
      s5: {
        title: 'Calculate the ripple',
        text: 'The **Vpp** value of CH2 is the ripple voltage.',
        q: 'Using V_r ≈ V_p / (f·R·C) (V_p = 9.2 V, f = 1 kHz, R = 1 kΩ, C = 10 µF), roughly what is the ripple?',
        o: ['≈ 0.9 V', '≈ 9.2 V', '≈ 0.09 V', '≈ 2.9 V'],
        e: 'V_r ≈ 9.2 / (1000 · 1000 · 10·10⁻⁶) = 0.92 V. The value you measure may be a little lower; the formula assumes the capacitor discharges for the whole period.',
      },
      s6: {
        title: 'Lighten the load',
        text: 'Set **RL** to **10 kΩ**. What happens to the ripple as the time constant τ = R·C grows?',
        success: 'τ = 100 ms ≫ T = 1 ms → the capacitor hardly discharges, the ripple dropped ~10 times.',
      },
    },
  },
  'pullup-pulldown': {
    theory:
      'Digital inputs have high impedance; when left unconnected (floating) their level is undefined. A pull-down resistor weakly pulls the input to 0, a pull-up to 1; the button easily overpowers this weak pull. Typical values are 4.7–47 kΩ: a small value is more noise-immune but draws more current when pressed (5 V/10 kΩ = 0.5 mA).',
    steps: {
      run: { title: 'Start', text: '**▶ Start**. S1 is open: the pull-down resistor is not connected. The P_IN indicator shows **?**.' },
      q1: {
        title: 'Why undefined?',
        text: 'With the button open, the input of N1 is not connected to anything.',
        q: 'Why is the input undefined while the button is not pressed?',
        o: ['The input is floating; with its high impedance it drifts to random levels with noise and leakage', 'The button is broken', 'VCC is low', 'The gate is faulty'],
        e: 'A CMOS input draws practically no current; left unconnected, electrostatic noise and leakage move it between 0 and 1. In a real circuit the output flickers and power consumption rises.',
      },
      s1: { title: 'Connect the pull-down', text: 'Close **S1**: “pull” the input to ground through 10 kΩ.', success: 'The input is now a definite 0: P_IN = 0, output (NOT) = 1.' },
      s2: {
        title: 'Press the button',
        text: 'Press and hold **BTN1**.',
        success: 'When pressed the input is 5 V (the button is much stronger than 10 kΩ). Release it and the resistor pulls the input back to 0.',
      },
      q2: {
        title: 'Pull-up',
        text: 'The opposite is possible too.',
        q: 'With a pull-up, where is the button connected and what does the input become when pressed?',
        o: ['To ground; 0 when pressed (active-low)', 'To VCC; 1 when pressed', 'Nowhere', 'To the output'],
        e: 'A pull-up pulls the input to VCC and the button shorts it to ground → 0 while pressed. That is why internal pull-ups are common in microcontrollers.',
      },
    },
  },
  'logic-gates': {
    theory:
      'AND: 1 if all inputs are 1. OR: 1 if at least one is 1. XOR: 1 if the inputs differ. NAND/NOR are universal. In positive logic 5 V = 1, 0 V = 0. In real gates, inputs near the threshold are undefined.',
    steps: {
      run: { title: 'Start', text: '**▶ Start**. Double-click switches A and B to set them to 0/1; the indicators (P) show the outputs.' },
      s1: { title: 'A = 1', text: 'Set **A** to **1**.' },
      s2: { title: 'B = 1', text: 'Set **B** to **1** as well.' },
      q1: { title: 'XOR', text: 'Look at indicator G3.', q: 'What is the XOR output when A = 1 and B = 1?', o: ['0', '1', 'Undefined', '2'], e: 'XOR is 1 only when the inputs differ: 1 ⊕ 1 = 0. In addition it is the “sum without carry” bit.' },
      q2: {
        title: 'Universal gate',
        text: 'Think about NAND.',
        q: 'Why is NAND called a “universal gate”?',
        o: ['Every logic function can be built using only NAND gates', 'It is the fastest gate', 'It uses no power', 'It has three inputs'],
        e: 'NOT = NAND(A,A), AND = NOT(NAND), OR = NAND(¬A,¬B). That is why it is the basic building block in CMOS manufacturing.',
      },
    },
  },
  'opamp-inverting': {
    theory:
      'Ideal op-amp rules: the inputs draw no current, and with negative feedback V+ = V−. In the inverting circuit V− = 0 (virtual ground) → I = V_in/R1 = −V_out/R2 → A_v = −R2/R1. The input resistance is R1. The output cannot exceed the supply rails.',
    steps: {
      run: { title: 'Start', text: '**▶ Start**. Input 0.5 V peak (CH1), output on CH2.' },
      q1: { title: 'Gain', text: 'R1 = 1 kΩ, R2 = 10 kΩ', q: 'What are the output peak and phase?', o: ['5 V, inverted by 180°', '5 V, in phase', '0.5 V, inverted', '5.5 V, in phase'], e: 'A_v = −R2/R1 = −10 → 0.5 V × 10 = 5 V, inverted.' },
      q2: {
        title: 'Virtual ground',
        text: 'Select U1: V+ and V− are almost equal.',
        q: 'Why is the inverting input (V−) at ~0 V?',
        o: ['Negative feedback makes V− ≈ V+ = 0', 'V− is connected to ground', 'R1 is shorted', 'The op-amp input draws current'],
        e: 'Because the open-loop gain is huge (2·10⁵), the output adjusts itself to keep V+ − V− at ~0: virtual ground.',
      },
      s1: { title: 'Saturation', text: 'Set **R2** to **47 kΩ**.', success: 'That would need 0.5·47 = 23.5 V, but the supply is ±15 V: the output clips at ≈ ±13.5 V (saturation).' },
    },
  },
  '555-astable': {
    theory:
      'Inside a 555 there is a 3×5 kΩ divider, two comparators (Vcc/3 and 2Vcc/3) and an SR latch. The capacitor charges to 2Vcc/3 through R1+R2 (t_H = 0.693(R1+R2)C), then discharges to Vcc/3 through R2 via DIS (t_L = 0.693R2C).',
    steps: {
      run: { title: 'Start', text: '**▶ Start**. C1 charges and discharges between Vcc/3 and 2Vcc/3; the LED flashes.' },
      q1: { title: 'Frequency', text: 'R1 = 1 kΩ, R2 = 10 kΩ, C = 10 µF', q: 'Roughly what is the oscillation frequency?', o: ['≈ 6.9 Hz', '≈ 69 Hz', '≈ 0.69 Hz', '≈ 14 Hz'], e: 'f = 1.44/((R1 + 2R2)·C) = 1.44/(21k·10µ) ≈ 6.9 Hz.' },
      q2: {
        title: 'Duty cycle',
        text: 'Charging goes through R1+R2, discharging only through R2.',
        q: 'Roughly what is the duty cycle (the fraction of time the output is high)?',
        o: ['52%', '50%', '91%', '9%'],
        e: 'D = (R1+R2)/(R1+2R2) = 11/21 ≈ 52%. In the classic 555 astable D > 50%.',
      },
      s1: { title: 'Speed it up', text: 'Set **C1** to **1 µF**.', success: 'f ≈ 69 Hz: your eye can no longer see the flashing (persistence ~50 Hz). Reduce Time/div to 5 ms.' },
    },
  },
};

/** Bu deneyin föyü seçili dilde mevcut mu? (Türkçe her zaman var) */
export const sheetAvailable = (id: string) => getLang() !== 'en' || !!SHEET_EN[id];

const cache = new Map<string, Template>();
/** Şablonun seçili dile çevrilmiş kopyası (föy çevrilmemişse yalnızca başlıklar çevrilir) */
export function localizeTemplate(tpl: Template): Template {
  if (getLang() !== 'en') return tpl;
  const hit = cache.get(tpl.id);
  if (hit) return hit;
  const sh = SHEET_EN[tpl.id];
  const out: Template = {
    ...tpl,
    title: entryTitle(tpl),
    subtitle: entrySubtitle(tpl),
    theory: sh?.theory ?? tpl.theory,
    steps: tpl.steps.map((s) => {
      const e = sh?.steps[s.id];
      if (!e) return s;
      const check =
        s.check.kind === 'quiz'
          ? { ...s.check, question: e.q ?? s.check.question, options: e.o ?? s.check.options, explain: e.e ?? s.check.explain }
          : s.check.kind === 'manual'
            ? { ...s.check, label: e.label ?? (s.check.label ? t(s.check.label) : s.check.label) }
            : s.check;
      return { ...s, title: e.title ?? s.title, text: e.text ?? s.text, hint: e.hint ?? s.hint, success: e.success ?? s.success, check };
    }),
  };
  cache.set(tpl.id, out);
  return out;
}

/** Testler için: çevrilmiş föylerin adım kimlikleri gerçek şablonla eşleşmeli */
export const _SHEET_EN = SHEET_EN;
export const _ENTRY_EN = ENTRY_EN;
