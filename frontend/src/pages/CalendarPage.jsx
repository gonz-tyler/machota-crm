import React, { useState, useEffect } from "react";
import api from "../api";
import { Plus } from "lucide-react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { "en-US": enUS },
});

export default function CalendarPage() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await api.get("events/");
      const formattedEvents = response.data.map((event) => ({
        ...event,
        start: new Date(event.start_time),
        end: new Date(event.end_time),
        title: `${event.title} (${event.client_name})`,
      }));
      setEvents(formattedEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white h-screen">
      <header className="h-16 border-b flex items-center justify-between px-8 shrink-0">
        <h2 className="text-xl font-semibold text-gray-800">Calendario</h2>
        <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <Plus size={18} />
          <span>Nuevo Evento</span>
        </button>
      </header>
      <main className="flex-1 overflow-auto p-8">
        <div className="h-[700px] bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
          />
        </div>
      </main>
    </div>
  );
}
