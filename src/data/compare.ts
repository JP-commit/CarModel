export type DrivetrainId = 'petrol' | 'diesel' | 'electric';

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

