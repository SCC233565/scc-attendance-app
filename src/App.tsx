import { Routes, Route, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import MiniPlayer from './components/MiniPlayer';
import UploadStatusBanner from './components/UploadStatusBanner';
import Splash from './pages/Splash';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import Player from './pages/Player';
import SeriesPage from './pages/SeriesPage';
import LiveBroadcast from './pages/LiveBroadcast';
import Profile from './pages/Profile';
import Auth from './pages/Auth';
import PrayerRequest from './pages/PrayerRequest';
import Give from './pages/Give';
import Admin from './pages/Admin';
import AdminGate from './components/AdminGate';
import Notifications from './pages/Notifications';
import About from './pages/About';
import Contact from './pages/Contact';
import { Privacy, Terms } from './pages/LegalPages';

const NO_CHROME_ROUTES = ['/', '/player', '/auth', '/admin'];

export default function App() {
  const location = useLocation();
  const showChrome = !NO_CHROME_ROUTES.includes(location.pathname);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-surface-soft">
      <UploadStatusBanner />
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/home" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/library" element={<Library />} />
        <Route path="/favorites" element={<Library />} />
        <Route path="/player" element={<Player />} />
        <Route path="/series/:seriesName" element={<SeriesPage />} />
        <Route path="/live" element={<LiveBroadcast />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/prayer-request" element={<PrayerRequest />} />
        <Route path="/give" element={<Give />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route
          path="/admin"
          element={
            <AdminGate>
              <Admin />
            </AdminGate>
          }
        />
      </Routes>

      {showChrome && <MiniPlayer />}
      {showChrome && <BottomNav />}
    </div>
  );
}
