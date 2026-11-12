import type {
  BrakeType,
  DifferentialMode,
  DrivetrainLayout,
  SteeringType,
  SuspensionType,
  SystemId,
} from '../state/appState';

export interface DrivetrainSplitStats {
  label: string;
  frontPct: number;
  rearPct: number;
  leftRightRule: string;
  summary: string;
}

export const DRIVETRAIN_SPLITS: Record<DrivetrainLayout, DrivetrainSplitStats> = {
  fwd: {
    label: 'Front-Wheel Drive (FWD)',
    frontPct: 100,
    rearPct: 0,
    leftRightRule: 'Front axle handles both steering and acceleration',
    summary: 'Compact transaxle puts engine weight directly over the driven front tires for rain/snow grip.',
  },
  rwd: {
    label: 'Rear-Wheel Drive (RWD)',
    frontPct: 0,
    rearPct: 100,
    leftRightRule: 'Balanced 50:50 weight split — fronts steer, rears push',
    summary: 'Longitudinal propshaft drives rear differential; accelerates cleanly without torque steer.',
  },
  awd: {
    label: 'All-Wheel Drive (AWD)',
    frontPct: 45,
    rearPct: 55,
    leftRightRule: 'Center viscous/clutch coupling balances front & rear automatically',
    summary: 'Always active on pavement or snow, dynamically shifting torque toward wheels with grip.',
  },
  '4wd': {
    label: '4-Wheel Drive (4WD + Low Range)',
    frontPct: 50,
    rearPct: 50,
    leftRightRule: 'Mechanical transfer case locks front & rear shafts 50/50 for trails',
    summary: 'Includes a heavy-duty low-range reduction gearset (~2.7:1) for steep rock crawling.',
  },
};

export const DIFFERENTIAL_SUMMARIES: Record<DifferentialMode, string> = {
  open: 'Open Diff: Splits torque 50/50; if one tire hits ice, both wheels lose forward drive.',
  lsd: 'Limited-Slip (LSD): Friction clutches transfer extra twist to the wheel that still grips.',
  locking: 'Locking Diff: Mechanically locks left & right half-shafts 100% solid for deep mud/sand.',
  'torque-vectoring': 'Torque Vectoring: Overdrives outer rear wheel in corners to sharpen turn-in.',
};

export interface ExtendedSystemGuide {
  title: string;
  badge: string;
  items: { label: string; detail: string }[];
}

export const SYSTEM_DEEP_DIVE_GUIDES: Partial<Record<SystemId, ExtendedSystemGuide[]>> = {
  engine: [
    {
      title: 'Fuel & Air Intake Circuit',
      badge: 'Fuel & Air',
      items: [
        { label: 'In-Tank Fuel Pump & Rail', detail: 'Delivers pressurized fuel (4 bar MPFI, 200+ bar GDI, 2,000+ bar Diesel CRDI) to injectors.' },
        { label: 'Airbox, MAF & Throttle Body', detail: 'Filters dust, measures mass airflow into ECU, and meters air via butterfly plate.' },
        { label: 'Intercooler (Turbocharged)', detail: 'Air-to-air radiator cools compressed boost air so oxygen packs denser into cylinders.' },
      ],
    },
    {
      title: 'Lubrication Oil Circuit',
      badge: 'Oil Loop',
      items: [
        { label: 'Sump Pan & Pickup', detail: 'Stores 4–7 L motor oil beneath the crank; oil pump pushes pressurized film through galleries.' },
        { label: 'Hydrodynamic Bearings', detail: 'Keeps crankshaft journals floating on a micron-thin oil wedge with zero metal contact.' },
      ],
    },
  ],
  brakes: [
    {
      title: 'Tyres, Contact Patch & Safety',
      badge: 'Grip & Safety',
      items: [
        { label: 'Tire Construction', detail: 'Tread grooves evacuate water, steel belts stabilize footprint, and sidewalls absorb curb shock.' },
        { label: 'Brake Fade Physics', detail: 'Kinetic energy converts to heat; vented rotors shed 500°C heat faster than enclosed drums.' },
        { label: 'ABS & Crumple Zones', detail: 'ABS tone rings pulse pressure 15×/sec before lockup while front rails absorb crash energy.' },
      ],
    },
  ],
  exhaust: [
    {
      title: 'Emissions Scrubbing (EGR · DPF · SCR)',
      badge: 'Clean Air',
      items: [
        { label: 'EGR Valve', detail: 'Recirculates inert exhaust into intake to lower combustion peak temperature and cut NOx.' },
        { label: '3-Way Catalyst / DPF', detail: 'Honeycomb platinum converts CO/HC/NOx while diesel wall-flow filters trap soot particles.' },
        { label: 'AdBlue SCR Dosing', detail: 'Injects urea solution ahead of SCR catalyst to turn toxic NOx into nitrogen + water.' },
      ],
    },
  ],
  electrical: [
    {
      title: 'CAN Bus, ECU & ADAS Suite',
      badge: 'Electronics',
      items: [
        { label: 'CAN Bus Network', detail: 'Twin twisted copper wires carry 500 kbps real-time frames linking Engine ECU, ABS, and TCU.' },
        { label: 'ADAS Radar & Camera', detail: 'Front 77 GHz radar + windshield stereo camera power Adaptive Cruise & Auto Emergency Braking.' },
        { label: 'Occupant Restraints', detail: 'Pyrotechnic seatbelt pretensioners & multi-stage airbags fire within 30 milliseconds.' },
      ],
    },
  ],
};

export const SUB_VARIANT_LABELS: {
  brakes: { id: BrakeType; label: string }[];
  suspension: { id: SuspensionType; label: string }[];
  steering: { id: SteeringType; label: string }[];
} = {
  brakes: [
    { id: 'disc', label: 'Ventilated Disc' },
    { id: 'drum', label: 'Drum Brake' },
  ],
  suspension: [
    { id: 'macpherson', label: 'MacPherson Strut' },
    { id: 'double-wishbone', label: 'Double Wishbone' },
    { id: 'multi-link', label: 'Multi-Link' },
  ],
  steering: [
    { id: 'eps', label: 'Electric (EPS)' },
    { id: 'hydraulic', label: 'Hydraulic Power' },
  ],
};

