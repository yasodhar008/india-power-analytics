import { describe, it, expect } from 'vitest';
import { parseGenerationCSV, parseDemandCSV, deriveSummary } from './parseCSV.js';

describe('parseGenerationCSV', () => {
  it('parses valid generation CSV correctly', () => {
    const csv = `Source,Value,Date & Time
"THERMAL GENERATION",150000,"01-01-2024 10:00:00"
"THERMAL GENERATION",152000,"01-01-2024 10:15:00"
"HYDRO GENERATION",25000,"01-01-2024 10:00:00"`;

    const result = parseGenerationCSV(csv);

    // Grouped by source and hour (10). Average of 150000 and 152000 is 151000.
    expect(result).toEqual([
      { source: 'THERMAL GENERATION', hour: 10, value_mw: 151000 },
      { source: 'HYDRO GENERATION', hour: 10, value_mw: 25000 },
    ]);
  });

  it('handles missing values and falls back to 0', () => {
    const csv = `Source,Value,Date & Time
"WIND",,"01-01-2024 11:00:00"
"SOLAR",NaN,"01-01-2024 11:00:00"`;

    const result = parseGenerationCSV(csv);

    expect(result).toEqual([
      { source: 'WIND GENERATION', hour: 11, value_mw: 0 },
      { source: 'SOLAR GENERATION', hour: 11, value_mw: 0 },
    ]);
  });

  it('handles commas in numbers', () => {
    const csv = `Source,Value,Date & Time
"NUCLEAR","12,500","01-01-2024 14:00:00"`;

    const result = parseGenerationCSV(csv);
    expect(result).toEqual([
      { source: 'NUCLEAR GENERATION', hour: 14, value_mw: 12500 },
    ]);
  });

  it('handles different header casing', () => {
    const csv = `source,value,DateTime
"GAS",4000,"01-01-2024 09:30:00"`;

    const result = parseGenerationCSV(csv);
    expect(result).toEqual([
      { source: 'GAS GENERATION', hour: 9, value_mw: 4000 }
    ]);
  });

  it('handles time without date', () => {
    const csv = `Source,Value,Date & Time
"BIOMASS",1500,"15:45:00"`;

    const result = parseGenerationCSV(csv);
    expect(result).toEqual([
      { source: 'BIOMASS GENERATION', hour: 15, value_mw: 1500 }
    ]);
  });
});

describe('parseDemandCSV', () => {
  it('parses valid demand CSV correctly', () => {
    const csv = `Source/Value,Time
200000,"01-01-2024 18:00:00"
205000,"01-01-2024 18:30:00"`;

    const result = parseDemandCSV(csv);

    // Grouped by hour (18). Average of 200000 and 205000 is 202500.
    expect(result).toEqual([
      { hour: 18, value_mw: 202500 },
    ]);
  });

  it('handles commas and empty values', () => {
    const csv = `Value,Time
"210,000","01-01-2024 19:00:00"
,"01-01-2024 19:30:00"`;

    const result = parseDemandCSV(csv);

    // Average of 210000 and 0 is 105000.
    expect(result).toEqual([
      { hour: 19, value_mw: 105000 },
    ]);
  });

  it('handles different header casing', () => {
    const csv = `value,Date & Time
150000,"01-01-2024 12:00:00"`;

    const result = parseDemandCSV(csv);
    expect(result).toEqual([
      { hour: 12, value_mw: 150000 }
    ]);
  });

  it('handles time without date', () => {
    const csv = `Value,Time
160000,"14:30:00"`;

    const result = parseDemandCSV(csv);
    expect(result).toEqual([
      { hour: 14, value_mw: 160000 }
    ]);
  });
});

describe('deriveSummary', () => {
  it('calculates derived summaries correctly', () => {
    const date = '2024-01-01';
    const genRows = [
      { source: 'SOLAR GENERATION', hour: 10, value_mw: 50000 },
      { source: 'SOLAR GENERATION', hour: 11, value_mw: 60000 },
      { source: 'WIND GENERATION', hour: 10, value_mw: 30000 },
      { source: 'THERMAL GENERATION', hour: 10, value_mw: 100000 },
    ];

    const demandRows = [
      { hour: 10, value_mw: 180000 },
      { hour: 11, value_mw: 190000 },
    ];

    const summary = deriveSummary(date, genRows, demandRows);

    expect(summary).toMatchObject({
      data_date: '2024-01-01',
      peak_demand_mw: 190000,
      peak_solar_mw: 60000,
      peak_wind_mw: 30000,
      // avg_solar = 55000, avg_wind = 30000, avg_demand = 185000
      // avg_re = 85000
      // reSharePct = 85000 / 185000 * 100 = 45.9
      avg_re_share_pct: 45.9,
      // total_solar_mu = 55000 * 24 / 1000 = 1320
      total_solar_mu: 1320,
      // total_wind_mu = 30000 * 24 / 1000 = 720
      total_wind_mu: 720,
      // total_re_mu = 85000 * 24 / 1000 = 2040
      total_re_mu: 2040,
      // total_demand_mu = 185000 * 24 / 1000 = 4440
      total_demand_mu: 4440,
      data_sources: ['vidyut']
    });

    // note: 'notes' contains the current date, so we only match the other fields
    expect(summary.notes).toContain('Uploaded on ');
  });

  it('handles empty data', () => {
    const summary = deriveSummary('2024-01-02', [], []);

    expect(summary).toMatchObject({
      data_date: '2024-01-02',
      peak_demand_mw: 0,
      peak_solar_mw: 0,
      peak_wind_mw: 0,
      avg_re_share_pct: 0,
      total_solar_mu: 0,
      total_wind_mu: 0,
      total_re_mu: 0,
      total_demand_mu: 0,
      data_sources: ['vidyut']
    });
  });
});
