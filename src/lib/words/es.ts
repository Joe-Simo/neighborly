import type { Words } from "./en";
import type { Terms, WordSet } from "./sets";

const terms: Record<WordSet, Terms> = {
  general: {
    group: "grupo",
    member: "voluntario",
    members: "voluntarios",
    neighbor: "vecino",
    neighbors: "vecinos",
    visit: "visita",
    visits: "visitas",
  },
  vincentian: {
    group: "conferencia",
    member: "vicentino",
    members: "vicentinos",
    neighbor: "vecino",
    neighbors: "vecinos",
    visit: "Visita Domiciliaria",
    visits: "Visitas Domiciliarias",
  },
};

/** Spanish. Written without a native speaker's review; one is still owed. */
export function es(set: WordSet): Words {
  const t = terms[set];
  return {
    locale: "es",
    terms: t,
    menu: {
      week: "Esta semana",
      team: "Equipos",
      people: "Personas",
      commitments: "Compromisos",
      mine: "Mis compromisos",
      "time-off": "Días libres",
      tasks: "Tareas y reuniones",
      "help-line": "Línea de ayuda",
      neighbors: "Vecinos",
      treasury: "Tesorería",
      reports: "Informes",
      visits: set === "vincentian" ? "Visitas Domiciliarias" : "Visitas a casa",
    },
    shell: {
      menu: "Menú",
      menuTitle: "Tu espacio",
      menuLabel: "Menú de tu espacio",
      menuCurrent: (section) => `Menú de tu espacio, estás en: ${section}`,
      allSections: "Todas las secciones",
      workspace: "Tu espacio",
      current: "Aquí",
      skip: "Ir a tu espacio",
      signOut: "Salir",
      language: "Idioma",
      typedStays: "Lo que escriben las personas queda como lo escribieron.",
      member: "Miembro",
      team: "Equipo",
      limited: "Algunas listas muestran solo una parte. Usa Cargar más en la sección correspondiente para ver el resto.",
    },
    headings: {
      week: {
        title: "Buen trabajo, esta semana.",
        deck: "Tus compromisos, los planes de todos y lo que hay que saber.",
      },
      mine: {
        title: "Tu parte.",
        deck: "Lo que has aceptado, con lo necesario para llegar con calma.",
      },
      "time-off": {
        title: "Tiempo para la vida.",
        deck: "Avisa a tu equipo cuando vayas a estar fuera.",
      },
    },
    actions: {
      timeOff: "Planear días libres",
    },
    week: {
      comingUp: "Lo que viene",
      nextSevenDays: "Próximos 7 días",
      choiceAboveTitle: "Tu próxima decisión está arriba.",
      choiceAboveDetail:
        "Responde a tu invitación cuando quieras. Tus otros compromisos aparecerán aquí.",
      quietTitle: "Un pequeño respiro.",
      quietDetail:
        "No hay compromisos en los próximos siete días. Las fechas posteriores están en Compromisos.",
      fromGroup: set === "vincentian" ? "De tu conferencia" : "De tu grupo",
      noAnnouncementsTitle: "Todavía no hay avisos.",
      noAnnouncementsDetail: "Los avisos de tus coordinadores se guardarán aquí.",
    },
    mine: {
      accepted: "Compromisos aceptados",
      emptyTitle: "Todavía no hay nada en tu calendario.",
      emptyDetail:
        "Los compromisos que aceptes aparecerán aquí con todo lo necesario para prepararte.",
    },
    commitments: {
      emptyTitle: "No hay compromisos próximos.",
      emptyDetail:
        "Los compromisos nuevos aparecerán aquí con su fecha, persona y preparación.",
      placeOpen: "Hay un lugar libre",
      status: { accepted: "aceptado", open: "libre", cancelled: "cancelado" },
      viewPreparation: "Ver la preparación",
      viewCommitment: "Ver el compromiso",
      details: "Detalles",
    },
    requests: {
      title: "Tú decides",
      awaiting: (count) =>
        count === 1 ? "1 espera tu respuesta" : `${count} esperan tu respuesta`,
      fallbackTitle: "Petición para cubrir un turno",
      unavailable: "No se pueden mostrar los detalles del compromiso",
      accept: "Aceptar",
      decline: "No puedo",
      accepted: "Compromiso aceptado. Tu plan está al día.",
      declined: "Petición rechazada. No se te asignó ningún compromiso.",
    },
    detail: {
      cancelled:
        "Este compromiso está cancelado. Se conserva su historial y no se espera a nadie.",
      when: "Cuándo",
      where: "Dónde",
      whereUnknown: "Lugar por confirmar",
      person: "Persona",
      coordinator: "Coordinador",
      unassigned: "Sin asignar",
      fallbackTitle: "Compromiso",
      readyTitle: "Para llegar con calma",
      noPreparation:
        "Todavía no hay preparación. Pregunta a tu coordinador qué necesitas.",
      change: "Cambiar este compromiso",
      changeTitle: "Cambiar un compromiso",
      released: "Compromiso liberado. Tus otras fechas siguen igual.",
    },
    timeOff: {
      note: "Los días libres no te sacan de tus equipos. Los compromisos que ya tienes se cambian aparte, para que todos sepan qué está cubierto.",
      remove: "Quitar",
      removed: "Días libres quitados.",
      emptyTitle: "No tienes días libres planeados.",
      emptyDetail:
        "Agrega las fechas en que no estarás. Tu lugar en el equipo sigue igual.",
      coverTitle: "Peticiones para cubrir turnos",
      coverDeck:
        "Decide si los coordinadores pueden pedirte que cubras un compromiso libre. Cada petición necesita tu sí.",
      coverStop: "Dejar de recibir peticiones",
      coverStart: "Recibir peticiones",
      availableTitle: "Cuándo puedes ayudar",
      availableDeck:
        "Ofrece las fechas en que puedes cubrir un turno. Estar disponible no es aceptar un compromiso.",
      firstAvailable: "Primer día disponible",
      lastAvailable: "Último día disponible",
      addAvailable: "Agregar fechas disponibles",
    },
    timeOffForm: {
      firstDay: "Primer día",
      lastDay: "Último día",
      noteLabel: "Nota (opcional)",
      noteHelp: "Escribe solo lo que tus coordinadores necesitan saber.",
      orderError: "El último día debe ser el mismo que el primero o uno posterior.",
      review: "Revisar los compromisos afectados",
      checking: "Revisando tus compromisos…",
      affected: (count) =>
        count === 0
          ? "Ningún compromiso afectado"
          : count === 1
            ? "1 compromiso afectado"
            : `${count} compromisos afectados`,
      explain:
        "Al confirmar se liberan solo estos compromisos y se anotan tus días libres. Tus equipos y las otras fechas siguen igual.",
      back: "Volver",
      saving: "Guardando…",
      confirm: "Confirmar días libres",
      failed:
        "No pudimos confirmar estas fechas. Puede que tus compromisos hayan cambiado. Vuelve para revisar la lista actual.",
      saved: "Días libres guardados. Solo se liberaron los compromisos revisados.",
    },
    notices: {
      saved: "Guardado.",
      updated: "Actualizado.",
      failed: "No se pudo guardar el cambio. Inténtalo de nuevo.",
    },
    visits: {
      title: set === "vincentian" ? "Visitas Domiciliarias" : "Visitas a casa",
      count: (count) => `${count} ${count === 1 ? "visita" : "visitas"}, siempre de dos en dos`,
      notSaved: "No se guardó tu respuesta. Inténtalo de nuevo.",
      on: (street) => `Una visita en ${street}`,
      nearby: "una calle cercana",
      partner: (name) => `Con ${name}. Tu coordinador tiene la hoja de la visita.`,
      go: "Voy",
      cannot: "No puedo ir",
      going: "Vas a ir",
      notGoing: "No puedes ir",
      cannotAfterAll: "Al final no puedo ir",
      canAfterAll: "Al final sí puedo ir",
    },
    yearCheck: {
      title: "Antes de enviarlo",
      count: (count) => (count === 1 ? "1 registro para revisar" : `${count} registros para revisar`),
      clear: "Todo cuadra.",
      approvedNotPaid: "Aprobada hace más de un mes, y no hay ningún pago anotado.",
      paidNoPayment: "Marcada como pagada, y no hay ningún pago en el libro.",
      visitNoHours: "Una visita terminada sin horas anotadas.",
      noteSaysPaid: "La nota dice que se pagó, y no hay ningún pago anotado.",
      visitNotMarked: "La nota dice que la visita se hizo, y no está marcada como hecha.",
      byRule: "Se encontró al contar.",
      byAssistant: "El asistente leyó la nota. Léela tú también.",
      open: "Abrir el registro",
    },
    urgent: {
      label: "Llamar primero",
      origin: "El asistente la puso primero por la nota. Puedes moverla.",
      shutoff: (day) => (day ? `Corte de servicio el día ${day}` : "Aviso de corte de servicio"),
      eviction: (day) => (day ? `Desalojo el día ${day}` : "Aviso de desalojo"),
      noFood: "Sin comida hoy",
      child: "Niños en casa",
      elder: "Persona mayor o que vive sola",
      medical: "Una necesidad médica",
      notUrgent: "No es urgente",
    },
    assistant: {
      title: "Borrador para ti",
      waiting: (count) =>
        count === 1 ? "1 espera tu sí" : `${count} esperan tu sí`,
      origin:
        "Escrito por el asistente a partir de la nota de la llamada. No se guarda nada hasta que lo apruebes.",
      checked: "El asistente comparó cada dato con la nota.",
      review: "El asistente no pudo comprobarlo. Lee cada dato junto a la nota.",
      blank: "Quedó en blanco porque la nota no lo dice con claridad.",
      approve: "Aprobar la petición",
      change: "Cambiar",
      discard: "Descartar",
    },
  };
}
