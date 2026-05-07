import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext({ tema: 'escuro', toggle: () => {}, setTema: () => {} });

export function ThemeProvider({ children }) {
    const [tema, setTema] = useState(() => {
        try { return localStorage.getItem('transnet-theme') || 'escuro'; }
        catch { return 'escuro'; }
    });

    useEffect(() => {
        document.documentElement.dataset.theme = tema;
        document.body.dataset.theme = tema;
        try { localStorage.setItem('transnet-theme', tema); } catch {}
    }, [tema]);

    const toggle = useCallback(() => setTema(t => t === 'escuro' ? 'claro' : 'escuro'), []);

    return (
        <ThemeContext.Provider value={{ tema, toggle, setTema }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
