export type DrivetrainId = 'petrol' | 'diesel' | 'electric';
export type CompareCategory = 'drivetrains' | 'transmissions';
export type CompareTransmissionId = 'manual' | 'at' | 'cvt' | 'dct';

export interface DrivetrainCompareSpec {
  id: DrivetrainId;
  name: string;
  subtitle: string;
  badge: string;
  ignition: string;
  movingParts: string;
  gearbox: string;
  torqueCurve: string;
  efficiency: string;
  emissions: string;
  analogy: string;
}

export interface TransmissionCompareSpec {
  id: CompareTransmissionId;
  name: string;
  subtitle: string;
  badge: string;
  mechanism: string;
  shiftFeel: string;
  efficiency: string;
  launchBehavior: string;
  maintenance: string;
  analogy: string;
}

export const DRIVETRAIN_SPECS: DrivetrainCompareSpec[] = [
  {
    id: 'petrol',
    name: 'Petrol (Gasoline)',
    subtitle: 'Spark-ignition 4-stroke engine + multi-speed gearbox',
    badge: 'Spark Ignition',
    ignition: 'Spark plug fires a small electric arc to ignite squeezed air + petrol mist.',
    movingParts: '~200+ moving powertrain parts (pistons, valves, camshafts, gears).',
    gearbox: 'Needs 6–8 speeds to keep the engine inside its smooth RPM sweet spot.',
    torqueCurve: 'Builds power smoothly as RPM climbs; loves revving high.',
    efficiency: '~28–38% fuel energy reaches the wheels (rest leaves as heat).',
    emissions: 'CO₂, water vapor, plus trace pollutants scrubbed by catalytic converter.',
    analogy: 'Like a sprinter breathing quick rhythmic bursts through shifting gears.',
  },
  {
    id: 'diesel',
    name: 'Diesel',
    subtitle: 'High-compression auto-ignition + turbo + heavy gearbox',
    badge: 'Compression Ignition',
    ignition: 'Squeezes air ~2× tighter until red-hot, then injects diesel that self-ignites (no spark plug!).',
    movingParts: '~200+ heavy-duty reinforced parts + turbocharger turbine.',
    gearbox: 'Multi-speed gearbox tuned for lower RPM and heavy pulling loads.',
    torqueCurve: 'Huge low-RPM twisting pull ideal for towing, trucks, and long highway range.',
    efficiency: '~38–45% fuel energy reaches the wheels thanks to high compression.',
    emissions: 'Lower CO₂ per mile, but requires particulate filters & SCR NOx scrubbing.',
    analogy: 'Like a heavy-lift tugboat—slower revving, massive low-speed muscle.',
  },
  {
    id: 'electric',
    name: 'Electric (EV)',
    subtitle: 'Floor battery pack + inverter + single-speed electric motor',
    badge: 'Magnetic Rotation',
    ignition: 'No combustion at all—electromagnets spin the motor rotor cleanly using battery electricity.',
    movingParts: '~20 moving powertrain parts (rotor shaft, bearings, 1 reduction gear).',
    gearbox: 'Single-speed reduction gear only—instant forward & reverse without shifting.',
    torqueCurve: '100% peak twisting force available at 0 RPM the instant you touch the pedal.',
    efficiency: '~85–90% battery energy reaches the wheels + recovers braking energy.',
    emissions: 'Zero tailpipe emissions while driving (grid footprint depends on electricity source).',
    analogy: 'Like a silent magnetic ceiling fan directly connected to the axle.',
  },
];

export const TRANSMISSION_COMPARE_SPECS: TransmissionCompareSpec[] = [
  {
    id: 'manual',
    name: 'Manual (H-Gate)',
    subtitle: 'Dry friction clutch + stepped layshaft gears + synchronizers',
    badge: 'Direct Control',
    mechanism: 'Foot clutch disconnects input shaft while H-shifter slides synchronizer sleeves.',
    shiftFeel: 'Pause between gears under driver timing; crisp mechanical connection when engaged.',
    efficiency: '~95–97% mechanical efficiency with zero hydraulic pumping loss.',
    launchBehavior: 'Relies on smoothly modulating clutch pedal bite point.',
    maintenance: 'Simple gear oil changes; periodic friction clutch wear over high mileage.',
    analogy: 'Like shifting a multi-speed mountain bike manually by hand.',
  },
  {
    id: 'at',
    name: 'Automatic (AT)',
    subtitle: 'Fluid torque converter + stacked planetary gearsets',
    badge: 'Fluid Smoothness',
    mechanism: 'Turbine fluid coupling drives sun/planet/ring gearsets switched by wet clutch packs.',
    shiftFeel: 'Seamless powershifting with zero power drop and cushioned stop-and-go creep.',
    efficiency: '~86–92% (near direct once internal lock-up clutch clamps at highway speed).',
    launchBehavior: 'Stator multiplies launch torque ~2× smoothly at low speed.',
    maintenance: 'Periodic ATF fluid & filter service keeps valve body solenoids sharp.',
    analogy: 'Like two oil-submerged water wheels feeding a solar-system gearset.',
  },
  {
    id: 'cvt',
    name: 'CVT (Steel Belt)',
    subtitle: 'Hydraulic conical pulleys + segmented steel push-belt',
    badge: 'Stepless Ratio',
    mechanism: 'Movable pulley cones slide inversely so belt radius shifts continuously.',
    shiftFeel: 'Zero discrete gear steps; engine holds steady RPM while car accelerates.',
    efficiency: '~84–90%; maximizes fuel economy by holding engine in optimal RPM band.',
    launchBehavior: 'Smooth hydraulic start clutch or fluid coupling into low pulley ratio.',
    maintenance: 'Requires specialized high-friction CVT fluid at factory intervals.',
    analogy: 'Like sliding smoothly along an infinitely adjustable ramp instead of stairs.',
  },
  {
    id: 'dct',
    name: 'Dual-Clutch (DCT)',
    subtitle: 'Concentric odd/even shafts + K1/K2 pre-selecting clutches',
    badge: 'Lightning Shifts',
    mechanism: 'Inactive shaft pre-meshes the next gear; computer cross-fades K1 & K2 clutches.',
    shiftFeel: 'Milliseconds-quick continuous acceleration with crisp sporty snap.',
    efficiency: '~94–96% mechanical gear efficiency like a manual without fluid converter drag.',
    launchBehavior: 'Computer slips K1 wet/dry clutch smoothly from rest.',
    maintenance: 'Dual-clutch oil & mechatronic fluid service every ~40–60k miles.',
    analogy: 'Like two relay runners passing the baton cleanly at full sprint.',
  },
];
