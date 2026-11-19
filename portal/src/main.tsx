import AOS from "aos";
import "aos/dist/aos.css";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Aplicaciones } from "./components/Aplicaciones";
import { BotonWhatsApp } from "./components/BotonWhatsApp";
import { Contacto, Footer } from "./components/Contacto";
import { Navbar } from "./components/Navbar";
import { Hero, Nosotros, Proyectos, Servicios } from "./components/Secciones";
import "./index.css";

function Portal() {
  useEffect(() => {
    AOS.init({ duration: 1200, once: true });
  }, []);

  return (
    <>
      <Navbar />
      <Hero />
      <Nosotros />
      <Servicios />
      <Aplicaciones />
      <Proyectos />
      <Contacto />
      <Footer />
      <BotonWhatsApp />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Portal />
  </StrictMode>,
);
