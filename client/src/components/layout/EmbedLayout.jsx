import { Outlet } from 'react-router-dom';

/**
 * A minimal layout specifically meant for micro-frontend embeds.
 * We want a clean transparent or plain background, without standard app chrome.
 */
export function EmbedLayout() {
    return (
        <div className="min-h-screen bg-transparent flex flex-col justify-center items-center p-2 font-sans overflow-hidden">
            <Outlet />
        </div>
    );
}
