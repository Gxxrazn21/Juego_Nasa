// Datos de respaldo si la API de la NASA no responde (sin red o límite de DEMO_KEY).
// Son eventos históricos reales del ciclo solar 25 registrados en DONKI.
export const FALLBACK_FLARES = [
  { flrID: '2024-05-10T06:27:00-FLR-001', beginTime: '2024-05-10T06:27Z', peakTime: '2024-05-10T06:54Z', classType: 'X3.9', sourceLocation: 'S17W29', activeRegionNum: 13664 },
  { flrID: '2024-05-11T01:10:00-FLR-001', beginTime: '2024-05-11T01:10Z', peakTime: '2024-05-11T01:23Z', classType: 'X5.8', sourceLocation: 'S15W45', activeRegionNum: 13664 },
  { flrID: '2024-05-14T16:46:00-FLR-001', beginTime: '2024-05-14T16:46Z', peakTime: '2024-05-14T16:51Z', classType: 'X8.7', sourceLocation: 'S18W89', activeRegionNum: 13664 },
  { flrID: '2024-10-03T12:08:00-FLR-001', beginTime: '2024-10-03T12:08Z', peakTime: '2024-10-03T12:18Z', classType: 'X9.0', sourceLocation: 'S15E18', activeRegionNum: 13842 },
];

export const FALLBACK_CMES = [
  { activityID: '2024-05-10T07:12:00-CME-001', startTime: '2024-05-10T07:12Z', note: 'CME asociada a la tormenta geomagnética G5 de mayo de 2024.' },
  { activityID: '2024-05-11T01:36:00-CME-001', startTime: '2024-05-11T01:36Z', note: 'CME rápida de la región activa 13664.' },
];
