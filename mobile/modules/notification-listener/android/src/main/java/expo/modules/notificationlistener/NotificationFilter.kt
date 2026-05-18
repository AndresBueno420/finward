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

    // Chat/social apps that must never pass through even if they mention money
    private val SOCIAL_BLACKLIST = setOf(
        "com.whatsapp",
        "com.whatsapp.w4b",
        "org.telegram.messenger",
        "com.telegram.messenger",
        "com.instagram.android",
        "com.facebook.katana",
        "com.facebook.orca",
        "com.twitter.android",
        "com.snapchat.android",
        "com.zhiliaoapp.musically",
        "com.ss.android.ugc.trill",
    )

    private val FINANCIAL_KEYWORDS = listOf(
        "compra", "pago", "transferencia", "enviaste", "recibiste",
        "débito", "debito", "crédito", "credito", "retiro",
        "consignación", "consignacion", "depósito", "deposito",
        "transacción", "transaccion", "acreditado", "cobro recibido",
    )

    fun shouldProcess(packageName: String, title: String, text: String): Boolean {
        if (packageName in BANKING_PACKAGES) return true
        if (packageName in SOCIAL_BLACKLIST) return false
        // Fallback for banking apps not yet in the whitelist
        val combined = (title + " " + text).lowercase()
        return FINANCIAL_KEYWORDS.any { combined.contains(it) }
    }
}
