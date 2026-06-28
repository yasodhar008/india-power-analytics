import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3-geo';
import * as topojson from 'topojson-client';
import { interpolateBlues } from "d3-scale-chromatic";
import { scaleSequential } from 'd3-scale';

const STATE_NAME_MAP = {
  "andaman & nicobar": "Andaman and Nicobar Islands",
  "andaman and nicobar islands": "Andaman and Nicobar Islands",
  "andhra pradesh": "Andhra Pradesh",
  "arunachal pradesh": "Arunachal Pradesh",
  "assam": "Assam",
  "bihar": "Bihar",
  "chandigarh": "Chandigarh",
  "chhattisgarh": "Chhattisgarh",
  "dadra & nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
  "dadra and nagar haveli and daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  "daman & diu": "Dadra and Nagar Haveli and Daman and Diu",
  "delhi": "Delhi",
  "nct of delhi": "Delhi",
  "goa": "Goa",
  "gujarat": "Gujarat",
  "haryana": "Haryana",
  "himachal pradesh": "Himachal Pradesh",
  "jammu & kashmir": "Jammu and Kashmir",
  "jammu and kashmir": "Jammu and Kashmir",
  "jharkhand": "Jharkhand",
  "karnataka": "Karnataka",
  "kerala": "Kerala",
  "ladakh": "Ladakh",
  "lakshadweep": "Lakshadweep",
  "madhya pradesh": "Madhya Pradesh",
  "maharashtra": "Maharashtra",
  "manipur": "Manipur",
  "meghalaya": "Meghalaya",
  "mizoram": "Mizoram",
  "nagaland": "Nagaland",
  "odisha": "Odisha",
  "puducherry": "Puducherry",
  "punjab": "Punjab",
  "rajasthan": "Rajasthan",
  "sikkim": "Sikkim",
  "tamil nadu": "Tamil Nadu",
  "telangana": "Telangana",
  "tripura": "Tripura",
  "uttar pradesh": "Uttar Pradesh",
  "uttarakhand": "Uttarakhand",
  "west bengal": "West Bengal"
};

const normalizeStateName = (name) => {
  if (!name) return "";
  const lower = name.trim().toLowerCase();
  return STATE_NAME_MAP[lower] || name.trim();
};

export default function IndiaMap({ data, selectedMetric, onStateClick }) {
  const [geoData, setGeoData] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/geohacker/india/master/state/india_telengana.geojson')
      .then(res => res.json())
      .then(json => setGeoData(json))
      .catch(err => console.error("Error fetching map:", err));
  }, []);

  if (!geoData) return <div className="h-64 flex items-center justify-center text-gray-500">Loading Map...</div>;

  const width = 450;
  const height = 550;

  // Fit projection to India
  const projection = d3.geoMercator().fitSize([width, height], geoData);
  const pathGenerator = d3.geoPath().projection(projection);

  // Normalize data into a lookup map
  const stateDataMap = {};
  let minVal = Infinity;
  let maxVal = -Infinity;

  if (data) {
    data.forEach(row => {
      const stateName = normalizeStateName(row.state);
      const val = row[selectedMetric.key] || 0;
      stateDataMap[stateName] = { ...row, _normalizedName: stateName, val };
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    });
  }

  if (minVal === Infinity) minVal = 0;
  if (maxVal === -Infinity) maxVal = 100;

  const colorScale = scaleSequential()
    .domain([minVal, maxVal])
    .interpolator(interpolateBlues);

  return (
    <div className="relative" style={{ width: '100%', height: '100%' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full drop-shadow-md"
        onMouseLeave={() => setHoveredState(null)}
      >
        <g>
          {geoData.features.map((feature, i) => {
            const rawName = feature.properties.ST_NM || feature.properties.name;
            const normName = normalizeStateName(rawName);
            const stateDatum = stateDataMap[normName];
            const val = stateDatum ? stateDatum.val : 0;
            const fillColor = stateDatum ? colorScale(val) : '#f1f5f9';

            return (
              <path
                key={`path-${i}`}
                d={pathGenerator(feature)}
                fill={fillColor}
                stroke="#ffffff"
                strokeWidth="0.8"
                className="transition-colors duration-200 cursor-pointer hover:opacity-80"
                onMouseEnter={(e) => {
                  const rect = svgRef.current.getBoundingClientRect();
                  setHoveredState({ name: normName, val, raw: stateDatum });
                  setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseMove={(e) => {
                  const rect = svgRef.current.getBoundingClientRect();
                  setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onClick={() => {
                  if (onStateClick && stateDatum) {
                    onStateClick(stateDatum);
                  }
                }}
              />
            );
          })}
        </g>
      </svg>

      {hoveredState && (
        <div
          className="absolute pointer-events-none bg-gray-900 text-white text-xs py-1 px-2 rounded shadow-lg z-50 whitespace-nowrap"
          style={{
            left: tooltipPos.x + 10,
            top: tooltipPos.y - 20,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="font-bold">{hoveredState.name}</div>
          <div>{selectedMetric.label}: {hoveredState.val?.toFixed(1) || 0}</div>
        </div>
      )}
    </div>
  );
}
