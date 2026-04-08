'use client';

import React, { useState, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  label?: string;
}

interface PresetOption {
  label: string;
  getValue: () => { startDate: string; endDate: string };
}

// ============================================================================
// Utility Functions
// ============================================================================

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getPresets = (): PresetOption[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const last7Days = new Date(today);
  last7Days.setDate(last7Days.getDate() - 6);

  const last30Days = new Date(today);
  last30Days.setDate(last30Days.getDate() - 29);

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const thisYearStart = new Date(today.getFullYear(), 0, 1);

  const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
  const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);

  return [
    {
      label: 'Bugun',
      getValue: () => ({
        startDate: formatDateForInput(today),
        endDate: formatDateForInput(today),
      }),
    },
    {
      label: 'Kecha',
      getValue: () => ({
        startDate: formatDateForInput(yesterday),
        endDate: formatDateForInput(yesterday),
      }),
    },
    {
      label: 'Oxirgi 7 kun',
      getValue: () => ({
        startDate: formatDateForInput(last7Days),
        endDate: formatDateForInput(today),
      }),
    },
    {
      label: 'Oxirgi 30 kun',
      getValue: () => ({
        startDate: formatDateForInput(last30Days),
        endDate: formatDateForInput(today),
      }),
    },
    {
      label: 'Shu oy',
      getValue: () => ({
        startDate: formatDateForInput(thisMonthStart),
        endDate: formatDateForInput(today),
      }),
    },
    {
      label: "O'tgan oy",
      getValue: () => ({
        startDate: formatDateForInput(lastMonthStart),
        endDate: formatDateForInput(lastMonthEnd),
      }),
    },
    {
      label: 'Shu yil',
      getValue: () => ({
        startDate: formatDateForInput(thisYearStart),
        endDate: formatDateForInput(today),
      }),
    },
    {
      label: "O'tgan yil",
      getValue: () => ({
        startDate: formatDateForInput(lastYearStart),
        endDate: formatDateForInput(lastYearEnd),
      }),
    },
  ];
};

// ============================================================================
// Calendar Component
// ============================================================================

interface CalendarProps {
  month: Date;
  selectedStart: string;
  selectedEnd: string;
  onDateClick: (date: Date) => void;
  onMonthChange: (delta: number) => void;
  isSelectingEnd: boolean;
  hoverDate: Date | null;
  onHover: (date: Date | null) => void;
}

const Calendar: React.FC<CalendarProps> = ({
  month,
  selectedStart,
  selectedEnd,
  onDateClick,
  onMonthChange,
  isSelectingEnd,
  hoverDate,
  onHover,
}) => {
  const daysOfWeek = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

  const getDaysInMonth = (date: Date): (Date | null)[] => {
    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);

    const days: (Date | null)[] = [];

    // Add empty slots for days before the first day of month
    let startDay = firstDay.getDay() - 1; // Monday = 0
    if (startDay < 0) startDay = 6; // Sunday

    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, monthIndex, i));
    }

    return days;
  };

  const isDateInRange = (date: Date): boolean => {
    if (!selectedStart) return false;

    const dateStr = formatDateForInput(date);
    const start = selectedStart;
    const end = selectedEnd || (hoverDate ? formatDateForInput(hoverDate) : null);

    if (!end) return dateStr === start;

    const [actualStart, actualEnd] = start <= end ? [start, end] : [end, start];
    return dateStr >= actualStart && dateStr <= actualEnd;
  };

  const isStartDate = (date: Date): boolean => {
    return formatDateForInput(date) === selectedStart;
  };

  const isEndDate = (date: Date): boolean => {
    return formatDateForInput(date) === selectedEnd;
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const days = getDaysInMonth(month);

  const monthNames = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
  ];

  return (
    <div className="w-[280px]">
      {/* Month Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onMonthChange(-1)}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
        >
          <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {monthNames[month.getMonth()]} {month.getFullYear()}
        </span>
        <button
          onClick={() => onMonthChange(1)}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
        >
          <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {daysOfWeek.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-8" />;
          }

          const inRange = isDateInRange(date);
          const isStart = isStartDate(date);
          const isEnd = isEndDate(date);
          const isTodayDate = isToday(date);

          return (
            <button
              key={date.toISOString()}
              onClick={() => onDateClick(date)}
              onMouseEnter={() => isSelectingEnd && onHover(date)}
              onMouseLeave={() => onHover(null)}
              className={`
                h-8 text-sm rounded-md transition-all
                ${inRange && !isStart && !isEnd ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200' : ''}
                ${isStart || isEnd ? 'bg-blue-600 dark:bg-blue-500 text-white font-medium' : ''}
                ${!inRange && !isStart && !isEnd ? 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300' : ''}
                ${isTodayDate && !isStart && !isEnd ? 'ring-1 ring-blue-400 dark:ring-blue-500' : ''}
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Main DateRangePicker Component
// ============================================================================

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [leftMonth, setLeftMonth] = useState(() => {
    if (startDate) {
      return new Date(startDate);
    }
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return now;
  });
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const rightMonth = new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset temp values
        setTempStartDate(startDate);
        setTempEndDate(endDate);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [startDate, endDate]);

  // Sync temp values when props change
  useEffect(() => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
  }, [startDate, endDate]);

  const handleDateClick = (date: Date) => {
    const dateStr = formatDateForInput(date);

    if (!isSelectingEnd || !tempStartDate) {
      // Start new selection
      setTempStartDate(dateStr);
      setTempEndDate('');
      setIsSelectingEnd(true);
      setActivePreset(null);
    } else {
      // Complete selection
      if (dateStr < tempStartDate) {
        setTempEndDate(tempStartDate);
        setTempStartDate(dateStr);
      } else {
        setTempEndDate(dateStr);
      }
      setIsSelectingEnd(false);
      setActivePreset(null);
    }
  };

  const handlePresetClick = (preset: PresetOption) => {
    const range = preset.getValue();
    setTempStartDate(range.startDate);
    setTempEndDate(range.endDate);
    setIsSelectingEnd(false);
    setActivePreset(preset.label);
  };

  const handleApply = () => {
    onStartDateChange(tempStartDate);
    onEndDateChange(tempEndDate);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempStartDate('');
    setTempEndDate('');
    setActivePreset(null);
    onStartDateChange('');
    onEndDateChange('');
    setIsOpen(false);
  };

  const handleMonthChange = (delta: number) => {
    setLeftMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const getDisplayText = (): string => {
    if (!startDate && !endDate) return 'Sana tanlang';
    if (startDate && !endDate) return formatDateForDisplay(startDate);
    if (startDate && endDate) {
      if (startDate === endDate) return formatDateForDisplay(startDate);
      return `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`;
    }
    return 'Sana tanlang';
  };

  const presets = getPresets();

  return (
    <div className="relative z-20" ref={containerRef}>
      {/* Label */}
      {/* <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Sana</label> */}

      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all min-w-[200px]"
      >
        <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {label && <span className="text-slate-500 dark:text-slate-400 text-xs">{label}:</span>}
        <span className={startDate || endDate ? 'text-slate-900 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}>
          {getDisplayText()}
        </span>
        <svg className={`w-4 h-4 text-slate-400 dark:text-slate-500 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex">
            {/* Presets */}
            <div className="w-40 border-r border-slate-200 dark:border-slate-700 py-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                    activePreset === preset.label
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <div className="border-t border-slate-200 dark:border-slate-700 mt-2 pt-2">
                <button
                  onClick={() => setActivePreset(null)}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                    activePreset === null && (tempStartDate || tempEndDate)
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Boshqa
                </button>
              </div>
            </div>

            {/* Calendars */}
            <div className="p-4">
              <div className="flex gap-4">
                <Calendar
                  month={leftMonth}
                  selectedStart={tempStartDate}
                  selectedEnd={tempEndDate}
                  onDateClick={handleDateClick}
                  onMonthChange={handleMonthChange}
                  isSelectingEnd={isSelectingEnd}
                  hoverDate={hoverDate}
                  onHover={setHoverDate}
                />
                <Calendar
                  month={rightMonth}
                  selectedStart={tempStartDate}
                  selectedEnd={tempEndDate}
                  onDateClick={handleDateClick}
                  onMonthChange={handleMonthChange}
                  isSelectingEnd={isSelectingEnd}
                  hoverDate={hoverDate}
                  onHover={setHoverDate}
                />
              </div>

              {/* Selected Range Display */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {tempStartDate && tempEndDate ? (
                    <span>
                      {formatDateForDisplay(tempStartDate)} - {formatDateForDisplay(tempEndDate)}
                    </span>
                  ) : tempStartDate ? (
                    <span>{formatDateForDisplay(tempStartDate)} - Tugash sanasini tanlang</span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">Sana oralig'ini tanlang</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClear}
                    className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                  >
                    Tozalash
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                  >
                    Bekor
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={!tempStartDate}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                  >
                    Qo'llash
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
