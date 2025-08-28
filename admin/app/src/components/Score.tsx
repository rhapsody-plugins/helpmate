import React from 'react';

interface ScoreProps {
  score: number;
}

const Score: React.FC<ScoreProps> = ({ score }) => (
  <div className="flex flex-col items-center">
    <div className="flex relative justify-center items-center w-16 h-16">
      <svg className="w-full h-full" viewBox="0 0 36 36">
        <circle
          className="text-gray-200"
          strokeWidth="3"
          stroke="currentColor"
          fill="none"
          cx="18"
          cy="18"
          r="16"
        />
        <circle
          className="text-primary"
          strokeWidth="3"
          strokeDasharray="100, 100"
          strokeDashoffset={100 - score}
          strokeLinecap="round"
          stroke="currentColor"
          fill="none"
          cx="18"
          cy="18"
          r="16"
          transform="rotate(-90 18 18)"
          style={{ transition: 'stroke-dashoffset 0.5s' }}
        />
      </svg>
      <span className="absolute text-xl font-medium text-primary">{score}</span>
    </div>
    <span className="mt-2 text-base font-medium text-center text-gray-500">
      Sales boost score out of 100
    </span>
  </div>
);

export default Score;
