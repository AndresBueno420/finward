package expo.modules.notificationlistener

object NotificationFilter {

    private val BANKING_PACKAGES = setOf(
        // Nu Colombia
        "com.nu.production",
        // Nequi
        "com.nequi.mobileapp",
        // Bancolombia
        "com.bancolombia.sucursalvirtual",
        "com.bancolombia.sucursal",
        // Daviplata / Davivienda
        "com.davivienda.daviplata",
        "com.davivienda.movil",
        // Banco de Bogotá
        "com.bancodebogota.bancamovil",
        // BBVA Colombia
        "com.bbva.bbvamovil",
        "com.bbva.netcash",
        // Lulobank
        "com.lulobank",
        // AV Villas
        "com.bancoavvillas.movil",
        // Scotiabank Colombia
        "com.colpatria.scoti",
        // Rappi / RappiBank
        "com.rappi.bank",
        "com.rappi.app",
        // Bold (POS que notifica pagos recibidos)
        "co.bold.app",
    )

    // Fallback para apps bancarias no listadas o apps de pago emergentes.
    // Se evalúa sobre (title + text) en minúsculas solo si el packageName no está en whitelist.
    private val FINANCIAL_KEYWORDS = listOf(
        // Gastos
        "compra", "pago", "transferencia", "retiro", "depósito",
        "consignación", "cobro", "cargo", "abono", "recarga",
        "aprobad", "exitoso", "realizad", "completad", "procesad",
        "saldo", "disponible", "débito", "crédito",
        // Ingresos — "recibi" cubre: recibiste, recibida, recibido
        "recibi", "enviaron", "acreditad", "ingreso",
        // Símbolos/monedas
        "$", "cop", "usd",
    )

    fun shouldProcess(packageName: String, title: String, text: String): Boolean {
        if (packageName in BANKING_PACKAGES) return true
        val combined = "$title $text".lowercase()
        return FINANCIAL_KEYWORDS.any { combined.contains(it) }
    }
}
