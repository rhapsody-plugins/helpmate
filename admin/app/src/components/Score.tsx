import { HelpmatePricingURL } from '@/lib/constants';
import React from 'react';

interface ScoreProps {
  score: number;
  isPro: boolean;
}

const Score: React.FC<ScoreProps> = ({ score, isPro }) => {
  const scoreColor = score < 50 ? 'text-yellow-500' : 'text-green-500';

  return (
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
            className={scoreColor}
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
        <span className={`absolute text-xl font-medium ${scoreColor}`}>
          {score}
        </span>
      </div>
      <span className="mt-2 text-base font-medium text-center text-gray-500">
        Sales boost score out of 100
      </span>
      {!isPro && (
        <a
          href={HelpmatePricingURL}
          target="_blank"
          className="mt-2 text-sm font-medium text-center underline text-primary"
        >
          Upgrade to Boost Sales
        </a>
      )}
    </div>
  );
};

export default Score;
